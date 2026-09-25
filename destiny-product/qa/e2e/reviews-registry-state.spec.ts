import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const fixturePath = process.env.QA_LOCAL_BROWSER_FIXTURE;
const fixture = fixturePath
  ? JSON.parse(readFileSync(fixturePath, "utf8")) as { mvp: { websiteId: string } }
  : null;

const profileUrl = "https://www.g2.com/products/synthetic-test/reviews";

test.describe("@gate Reviews registry state", () => {
  test("saved-profile evidence updates the count and guided step without a reload", async ({ page }) => {
    if (!fixture) throw new Error("Run pnpm qa:browser-fixture against disposable local Supabase first.");
    const profile = {
      directory_key: "g2",
      profile_url: profileUrl,
      status: "saved",
      http_status: null,
      last_checked_at: null,
      public_rating: null,
      public_review_count: null,
    };

    await page.route("**/api/directory-profiles", async (route) => {
      const input = route.request().postDataJSON();
      expect(input.websiteId).toBe(fixture!.mvp.websiteId);
      await route.fulfill({
        json: {
          profile: input.remove
            ? { ...profile, profile_url: null, status: "not_started" }
            : profile,
        },
      });
    });

    await page.goto(`/reviews?site=${fixture!.mvp.websiteId}`);
    const guidedStep = page.locator(".feature-journey-callout");
    const registry = page.locator("#directory-registry");
    const input = page.getByRole("textbox", { name: "G2 public profile URL", exact: true });
    const card = page.locator("article.directory-profile-card").filter({ has: input });

    await expect(registry.getByText("0 URLs saved", { exact: true })).toBeVisible();
    await expect(guidedStep.getByText("Your guided step", { exact: true })).toBeVisible();
    await expect(guidedStep.getByRole("link", { name: "Save one public profile", exact: true })).toBeVisible();

    await input.fill(profileUrl);
    await card.getByRole("button", { name: "Save URL", exact: true }).click();
    await expect(registry.getByText("1 URL saved", { exact: true })).toBeVisible();
    await expect(guidedStep.getByText("Guided step complete", { exact: true })).toBeVisible();
    await expect(guidedStep.getByText("Public profile saved", { exact: true })).toBeVisible();
    await expect(guidedStep.getByRole("link", { name: "Save one public profile", exact: true })).toHaveCount(0);

    await card.getByRole("button", { name: "Remove saved URL", exact: true }).click();
    await expect(registry.getByText("0 URLs saved", { exact: true })).toBeVisible();
    await expect(guidedStep.getByText("Your guided step", { exact: true })).toBeVisible();
    await expect(guidedStep.getByRole("link", { name: "Save one public profile", exact: true })).toBeVisible();
  });
});
