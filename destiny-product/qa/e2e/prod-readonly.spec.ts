import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { installProductionReadOnlyGuard } from "./support/read-only-guard";

const siteId = process.env.QA_SITE_ID ?? "fea021ec-1019-40ab-833b-536dfe154d8f";
const auditId = process.env.QA_AUDIT_ID ?? "e6f224d2-3da9-4e7d-9a88-2909cb0ae73d";
const authenticated = Boolean(process.env.QA_AUTH_STATE);

const routes = [
  "/this-week", "/roadmap", "/results", "/analytics", "/audits", `/audits/${auditId}`,
  "/content", "/keywords", "/keyword-research", "/rank-tracker", "/backlinks", "/distribution",
  "/reviews", "/integrations", "/llm-visibility", "/account",
];

test.describe("@gate Smart & Fast production read-only", () => {
  test.skip(!authenticated, "Set QA_AUTH_STATE to an authenticated Playwright storage-state file.");

  for (const route of routes) {
    test(`${route} loads the Smart & Fast workspace without mutation or serious accessibility errors`, async ({ page }) => {
      const guard = await installProductionReadOnlyGuard(page);
      const response = await page.goto(`${route}?site=${siteId}`, { waitUntil: "domcontentloaded" });
      expect(response?.status(), `${route} returned no successful document response`).toBeLessThan(400);
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.getByText("Smart & Fast Background Checks", { exact: true }).first()).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator("body")).not.toContainText(/internal server error|application error|something went wrong/i);

      const badScopedLinks = await page.locator('a[href^="/"]').evaluateAll((links, expectedSiteId) => {
        const workspaceRoutes = /^(\/this-week|\/roadmap|\/results|\/analytics|\/audits|\/content|\/keywords|\/keyword-research|\/rank-tracker|\/backlinks|\/distribution|\/reviews|\/integrations|\/llm-visibility|\/account)/;
        return links.map((link) => link.getAttribute("href") ?? "")
          .filter((href) => workspaceRoutes.test(href) && !href.includes(`site=${expectedSiteId}`));
      }, siteId);
      expect(badScopedLinks, `Links lost Smart & Fast context:\n${badScopedLinks.join("\n")}`).toEqual([]);

      const accessibility = await new AxeBuilder({ page }).analyze();
      const serious = accessibility.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? ""));
      expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
      guard.assertNoMutationAttempt();
    });
  }
});
