import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

type BrowserFixture = {
  mvp: {
    auditId: string;
    keyword: string;
    trackedKeywordId: string;
    websiteId: string;
  };
};

const fixturePath = process.env.QA_LOCAL_BROWSER_FIXTURE;
const fixture = fixturePath
  ? JSON.parse(readFileSync(fixturePath, "utf8")) as BrowserFixture
  : null;
if (!fixture) throw new Error("Run pnpm qa:browser-fixture against disposable local Supabase before MVP browser certification.");

test.describe("@gate certified MVP journey", () => {
  test("This Week presents only the four launch-certified actions", async ({ page }) => {
    await page.goto(`/this-week?site=${fixture!.mvp.websiteId}`);

    const reveal = page.getByRole("dialog", { name: "Your audit is done. Here’s your plan." });
    if (await reveal.isVisible()) await reveal.getByRole("button", { name: "Close plan reveal" }).click();

    await expect(page.getByRole("heading", { name: "Choose a category to see its complete checklist." })).toBeVisible();
    await expect(page.getByLabel("Weekly plan categories").getByRole("button")).toHaveCount(4);
    await expect(page.getByLabel("0 of 4 weekly tasks complete")).toBeVisible();
    await expect(page.getByText("Approve your priority keyword strategy", { exact: true })).toBeVisible();
    await expect(page.getByText("Review this week’s article", { exact: true })).toBeVisible();
    await expect(page.getByText("No task needed here this week.", { exact: true })).toBeVisible();
    await expect(page.getByText("Share the article on social media", { exact: true })).toHaveCount(0);
  });

  test("WordPress moves from Draft delivered to evidence-complete Verified live", async ({ page }) => {
    const verifiedAt = new Date().toISOString();
    const permalink = "https://browser-member.example/guides/seo-consulting-services/";
    let reconciliations = 0;
    await page.route("**/api/integrations/cms/wordpress/reconcile", async (route) => {
      reconciliations += 1;
      const body = reconciliations === 1
        ? {
            publicationStatus: "delivered_draft",
            remotePermalink: null,
            lastReconciledAt: verifiedAt,
            verifiedLiveAt: null,
            verificationEvidence: null,
          }
        : {
            publicationStatus: "verified_live",
            remotePermalink: permalink,
            lastReconciledAt: verifiedAt,
            verifiedLiveAt: verifiedAt,
            verificationEvidence: {
              verified: true,
              httpStatus: 200,
              canonicalMatches: true,
              contentMatches: true,
              indexable: true,
            },
          };
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(body), status: 200 });
    });

    await page.goto(`/content?site=${fixture!.mvp.websiteId}`);
    await expect(page.getByText("Draft delivered", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "View verified live article" })).toHaveCount(0);

    await page.getByRole("button", { name: "Check WordPress status" }).click();
    await expect(page.getByText("Verified live", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "View verified live article" })).toHaveAttribute("href", permalink);
    expect(reconciliations).toBeGreaterThanOrEqual(2);
  });

  test("Rank tracker reports saved weekly movement without inventing position zero", async ({ page }) => {
    await page.goto(`/rank-tracker?site=${fixture!.mvp.websiteId}`);

    await expect(page.getByRole("heading", { name: "What changed in your search visibility" })).toBeVisible();
    await expect(page.locator(".rank-weekly-report-metrics article").filter({ hasText: "Moved up" }).locator("strong")).toHaveText("1");
    await expect(page.getByText(fixture!.mvp.keyword, { exact: true }).first()).toBeVisible();
    await expect(page.getByText("#9", { exact: true })).toBeVisible();
    await expect(page.getByText("#0", { exact: true })).toHaveCount(0);
  });
});
