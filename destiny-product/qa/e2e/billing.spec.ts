import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Public entry never depends on an existing subscription or session.
test.describe("public subscription entry", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test("prices, trial terms and plan selection stay accessible on both viewports", async ({ page }) => {
    await page.goto("/pricing");
    for (const [name, price] of [["Starter", 39], ["Growth", 99], ["Premium", 250]] as const) {
      const plan = page.getByRole("article").filter({ has: page.getByRole("heading", { name, exact: true }) });
      await expect(plan.getByRole("link", { name: `Choose ${name}`, exact: true })).toBeVisible();
      await expect(plan).toContainText(`After 7 days, $${price}/month`);
      await expect(plan).toContainText("Cancel before the trial ends to avoid a charge.");
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(accessibility.violations.filter(issue => ["serious", "critical"].includes(issue.impact ?? ""))).toEqual([]);
    await page.getByRole("link", { name: "Choose Growth", exact: true }).click();
    await expect(page).toHaveURL(/\/login\?next=%2Faccount%2Fbilling%3Fplan%3Dgrowth$/);
    await expect(page.getByRole("button", { name: "Log in", exact: true })).toBeVisible();
  });
});

test("@gate unpaid account sees pricing without losing its saved workspace", async ({ page }) => {
  if (!process.env.QA_AUTH_STATE) throw new Error("Disposable authenticated browser fixture required.");
  await page.goto("/account/billing");
  await expect(page.getByRole("heading", { name: "Plans and billing", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Current subscription" })).toContainText("No active paid subscription");
  await expect(page.getByRole("region", { name: "Subscription notice" })).toContainText("Your saved work remains available.");
  for (const name of ["Starter", "Growth", "Premium"]) {
    await expect(page.getByRole("button", { name: `Start 7-day trial — ${name}`, exact: true })).toBeVisible();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.goto("/audits");
  await expect(page.locator("[data-workspace-website]")).toBeVisible();
});


test("@gate unpaid rank keyword remains saved and paused after add and resume", async ({ page }) => {
  if (!process.env.QA_AUTH_STATE) throw new Error("Disposable authenticated browser fixture required.");
  const keyword = `billing paused ${Date.now()} ${test.info().project.name}`;
  await page.goto("/rank-tracker");
  await expect(page.getByRole("status").filter({ hasText: "New rank checks are unavailable" })).toBeVisible();
  await expect(page.locator(".rank-summary-grid")).toContainText("New checks stopped");
  await page.getByRole("textbox", { name: "Keyword to track", exact: true }).fill(keyword);
  await page.getByRole("button", { name: "Track keyword", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: keyword });
  await expect(row).toContainText("Paused");
  await expect(page.getByRole("status").filter({ hasText: "Your keywords are saved" })).toBeVisible();
  await row.getByRole("button", { name: `Resume ${keyword}`, exact: true }).click();
  await expect(row.getByRole("button", { name: `Resume ${keyword}`, exact: true })).toBeEnabled();
  await expect(row).toContainText("Paused");
  await page.reload();
  await expect(page.getByRole("row").filter({ hasText: keyword })).toContainText("Paused");
});


test("@gate managed website selection persists without deleting saved sites", async ({ page }) => {
  if (!process.env.QA_AUTH_STATE) throw new Error("Disposable authenticated browser fixture required.");
  await page.goto("/account/billing");
  const section = page.getByRole("region", { name: "Managed websites", exact: true });
  const choices = section.getByRole("checkbox");
  const count = await choices.count();
  expect(count).toBeGreaterThan(1);
  // Both viewport fixtures select the same first website for the shared owner.
  await choices.first().check();
  await section.getByRole("button", { name: "Save managed websites", exact: true }).click();
  await expect(section.getByRole("status")).toContainText("Managed websites saved.");
  await page.reload();
  await expect(section.getByRole("checkbox").first()).toBeChecked();
  await expect(section.getByRole("checkbox")).toHaveCount(count);
  await expect(section).toContainText("does not start a subscription or a new free trial");
});
