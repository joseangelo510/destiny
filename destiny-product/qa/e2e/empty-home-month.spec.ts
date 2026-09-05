import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const fixturePath = process.env.QA_LOCAL_BROWSER_FIXTURE;
const fixture = fixturePath ? JSON.parse(readFileSync(fixturePath, "utf8")) as { alpha: { websiteId: string } } : null;

test("@gate Home without a publishing plan keeps a visible compact month", async ({ page }, testInfo) => {
  if (!fixture) throw new Error("Disposable browser fixture is required.");
  const mobile = testInfo.project.name === "mobile";
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1360, height: 1000 });
  await page.goto(`/app/home?site=${fixture.alpha.websiteId}`);
  const grid = page.locator('[data-empty-month="true"]');
  await expect(grid).toBeVisible();
  await expect(grid.locator(":scope > section")).toHaveCount(42);
  await expect(page.getByText("No saved items this month", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Ask Rebound/ })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(mobile ? 390 : 1360);
});
