import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { installProductionReadOnlyGuard } from "./support/read-only-guard";
import { parseProductionSiteMatrix } from "../support/prod-site-matrix";

const authenticated = process.env.QA_PROD_READONLY === "1" && Boolean(process.env.QA_AUTH_STATE);
const fallbackSites = JSON.stringify([{
  websiteId: process.env.QA_SITE_ID ?? "fea021ec-1019-40ab-833b-536dfe154d8f",
  auditId: process.env.QA_AUDIT_ID ?? "e6f224d2-3da9-4e7d-9a88-2909cb0ae73d",
  businessName: process.env.QA_BUSINESS_NAME ?? "Smart & Fast Background Checks",
}]);
const sites = parseProductionSiteMatrix(process.env.QA_PROD_SITES_JSON ?? fallbackSites);

test.describe("@gate production website matrix read-only", () => {
  test.skip(!authenticated, "Set QA_AUTH_STATE to an authenticated Playwright storage-state file.");

  for (const site of sites) {
    const routes = [
      "/this-week", "/roadmap", "/results", "/analytics", "/audits", `/audits/${site.auditId}`,
      "/content", "/keywords", "/keyword-research", "/rank-tracker", "/backlinks", "/distribution",
      "/reviews", "/integrations", "/llm-visibility", "/account",
    ];
    for (const route of routes) {
      test(`${site.businessName} ${route} loads without mutation, browser errors, or serious accessibility errors`, async ({ page }) => {
        const consoleErrors: string[] = [];
        const pageErrors: string[] = [];
        page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
        page.on("pageerror", (error) => pageErrors.push(error.message));
        const guard = await installProductionReadOnlyGuard(page);
        const response = await page.goto(`${route}?site=${site.websiteId}`, { waitUntil: "domcontentloaded" });
        expect(response?.status(), `${site.businessName} ${route} returned no successful document response`).toBeLessThan(400);
        await expect(page).not.toHaveURL(/\/login/);
        await expect(page.locator(`[data-workspace-website="${site.websiteId}"]`)).toBeVisible();
        await expect(page.getByText(site.businessName, { exact: true }).first()).toBeVisible();
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expect(page.locator("body")).not.toContainText(/internal server error|application error|something went wrong/i);

        const badScopedLinks = await page.locator('a[href^="/"]').evaluateAll((links, expectedSiteId) => {
          const workspaceRoutes = /^(\/this-week|\/roadmap|\/results|\/analytics|\/audits|\/content|\/keywords|\/keyword-research|\/rank-tracker|\/backlinks|\/distribution|\/reviews|\/integrations|\/llm-visibility|\/account)/;
          return links.map((link) => link.getAttribute("href") ?? "")
            .filter((href) => workspaceRoutes.test(href) && !href.includes(`site=${expectedSiteId}`));
        }, site.websiteId);
        expect(badScopedLinks, `Links lost ${site.businessName} context:\n${badScopedLinks.join("\n")}`).toEqual([]);

        const accessibility = await new AxeBuilder({ page }).analyze();
        const serious = accessibility.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? ""));
        expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
        expect(consoleErrors, `${site.businessName} ${route} emitted console errors`).toEqual([]);
        expect(pageErrors, `${site.businessName} ${route} emitted uncaught page errors`).toEqual([]);
        guard.assertNoMutationAttempt();
      });
    }
  }
});
