import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

type SiteFixture = {
  auditIds: string[];
  businessName: string;
  normalizedDomain: string;
  websiteId: string;
};

type BrowserFixture = {
  alpha: SiteFixture;
  beta: SiteFixture;
  member: SiteFixture;
  outsiderAuditId: string;
  outsiderSiteId: string;
};

const fixturePath = process.env.QA_LOCAL_BROWSER_FIXTURE;
const fixture = fixturePath
  ? JSON.parse(await readFile(fixturePath, "utf8")) as BrowserFixture
  : null;

test.describe("@gate authenticated local website switching", () => {
  test.skip(!fixture, "Run pnpm qa:browser-fixture against disposable local Supabase first.");

  test("shared user switches real websites without blending state", async ({ page }) => {
    const alpha = fixture!.alpha;
    const beta = fixture!.beta;

    await page.goto(`/audits?site=${alpha.websiteId}`);
    await expect(page.locator(`[data-workspace-website="${alpha.websiteId}"]`)).toBeVisible();
    await expect(page.locator(".workspace-header .eyebrow")).toHaveText(alpha.normalizedDomain);
    await expect(page.locator(".audit-history-compact .audit-section-heading > span")).toHaveText("1 saved");

    await page.locator(`[data-site-switch="${beta.websiteId}"]`).click({ force: true });
    await expect(page).toHaveURL(new RegExp(`site=${beta.websiteId}`));
    await expect(page.locator(`[data-workspace-website="${beta.websiteId}"]`)).toBeVisible();
    await expect(page.locator(".workspace-header .eyebrow")).toHaveText(beta.normalizedDomain);
    await expect(page.locator(".audit-history-compact .audit-section-heading > span")).toHaveText("2 saved");

    await page.goto("/content");
    await expect(page).toHaveURL(new RegExp(`site=${beta.websiteId}`));
    await expect(page.locator(`[data-workspace-website="${beta.websiteId}"]`)).toBeVisible();
  });

  test("shared user cannot read an outsider audit through the application API", async ({ page }) => {
    await page.goto(`/audits?site=${fixture!.member.websiteId}`);
    const response = await page.request.get(`/api/audits/${fixture!.outsiderAuditId}`);
    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ error: "Audit not found." });
  });
});
