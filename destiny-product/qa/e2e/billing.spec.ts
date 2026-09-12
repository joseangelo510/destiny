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
