import { readFileSync } from "node:fs";
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

test("@gate new account can save and select its first website before starting a trial", async ({ page, context }, testInfo) => {
  const fixture = JSON.parse(readFileSync(process.env.QA_LOCAL_BROWSER_FIXTURE!, "utf8"));
  const user = fixture.billingFirstUsers[testInfo.project.name];
  await context.clearCookies();
  await page.goto("/login?next=%2Faccount%2Fbilling%3Fplan%3Dgrowth");
  await page.getByLabel("Email address", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/account\/billing/);
  await page.getByRole("link", { name: "Add your first website", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tell us about your business", exact: true })).toBeVisible();
  // Save via the actual authenticated onboarding API. External audit/provider work is tested separately.
  const response = await page.request.post("/api/onboarding", { data: {
    firstName: "First", lastName: "Customer", email: "first@example.invalid", businessName: "First customer fixture",
    website: `https://first-${testInfo.project.name}.example`, productsServices: "SEO consulting for local businesses",
    customer: "Local business owners", problem: "Customers cannot find their services online",
    competitors: "https://competitor-one.example\nhttps://competitor-two.example", standout: "Practical advice based on each business"
  } });
  expect(response.ok()).toBe(true);
  const saved = await response.json();
  expect(saved.websiteId).toEqual(expect.any(String));
  await page.goto("/account/billing");
  const sites = page.getByRole("region", { name: "Managed websites", exact: true });
  await expect(sites.getByRole("checkbox")).toHaveCount(1);
  await expect(sites.getByRole("checkbox")).not.toBeChecked();
  await sites.getByRole("checkbox").check();
  await sites.getByRole("button", { name: "Save managed websites", exact: true }).click();
  await expect(sites.getByRole("status")).toContainText("Managed websites saved.");
  await page.reload();
  await expect(sites.getByRole("checkbox")).toBeChecked();
  await expect(page.getByRole("region", { name: "Current subscription" })).toContainText("No active paid subscription");
  await expect(page.getByRole("button", { name: "Start 7-day trial — Growth", exact: true })).toBeDisabled();
  await expect(page.getByRole("region", { name: "Subscription plans" })).toContainText("Start with one free website analysis after verified signup");
});
