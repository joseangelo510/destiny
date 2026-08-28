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
    const planCategories = page.getByLabel("Weekly plan categories");
    await expect(planCategories.getByRole("button")).toHaveCount(4);
    await expect(page.getByLabel("0 of 4 weekly tasks complete")).toBeVisible();
    await expect(planCategories.getByText("Approve your priority keyword strategy", { exact: true })).toBeVisible();
    await expect(planCategories.getByText("Review this week’s article", { exact: true })).toBeVisible();
    await expect(planCategories.getByText("No task needed here this week.", { exact: true })).toBeVisible();
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

    await expect.poll(() => reconciliations).toBeGreaterThanOrEqual(1);
    await expect(page.getByRole("button", { name: "Check WordPress status" })).toBeEnabled();
    await page.getByRole("button", { name: "Check WordPress status" }).click();
    await expect.poll(() => reconciliations).toBeGreaterThanOrEqual(2);
    await expect(page.locator(".cms-status-chip.verified_live")).toHaveText("Verified live");
    await expect(page.getByRole("link", { name: "View verified live article" })).toHaveAttribute("href", permalink);
    expect(reconciliations).toBeGreaterThanOrEqual(2);
  });

  test("Editorial calendar keeps a past-due WordPress schedule unverified until reconciliation", async ({ page }) => {
    const permalink = "https://browser-member.example/guides/seo-consulting-services/";
    let calendarChecks = 0;
    await page.route("**/api/content/publishing-plan/reconcile", async (route) => {
      calendarChecks += 1;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          verified: true,
          state: "published",
          remotePermalink: permalink,
          verifiedLiveAt: new Date().toISOString(),
        }),
        status: 200,
      });
    });

    await page.goto(`/content?site=${fixture!.mvp.websiteId}`);
    await expect(page.getByRole("button", { name: /Scheduled — past due, not yet verified/ }).first()).toBeVisible();
    await page.getByRole("button", { name: "Refresh WordPress status" }).first().click();

    await expect.poll(() => calendarChecks).toBe(1);
    await expect(page.getByText("WordPress confirmed that this post is live.")).toBeVisible();
    await expect(page.getByRole("button", { name: /Live and verified/ }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Scheduled — past due, not yet verified/ })).toHaveCount(0);
  });

  test("Rank tracker reports saved weekly movement without inventing position zero", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    await page.goto(`/rank-tracker?site=${fixture!.mvp.websiteId}`);

    await expect(page.getByRole("heading", { name: "What changed in your search visibility" })).toBeVisible();
    await expect(page.locator(".rank-weekly-report-metrics article").filter({ hasText: "Moved up" }).locator("strong")).toHaveText("1");
    await expect(page.getByText(fixture!.mvp.keyword, { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("table").getByText("#9", { exact: true })).toBeVisible();
    await expect(page.getByText("#0", { exact: true })).toHaveCount(0);
    expect(consoleErrors.filter((message) => /hydration|React error #418|server rendered HTML/i.test(message))).toEqual([]);
  });
});
