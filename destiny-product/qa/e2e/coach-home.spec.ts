import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const fixturePath = process.env.QA_LOCAL_BROWSER_FIXTURE;
const fixture = fixturePath ? JSON.parse(readFileSync(fixturePath, "utf8")) as { mvp: { websiteId: string }; alpha: { websiteId: string } } : null;

test("@gate Warm-up coach focuses real work and keeps the full workspace reachable", async ({ page }, testInfo) => {
  if (!fixture) throw new Error("Disposable browser fixture is required.");
  const width = testInfo.project.name === "mobile" ? 390 : 1360;
  await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
  const errors: string[] = [];
  const writes: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => { if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) writes.push(request.url()); });
  await page.goto(`/app/home?site=${fixture.mvp.websiteId}`);
  await expect(page.locator('[data-coach-home="warmup"]')).toBeVisible();
  const firstTitle = await page.locator("[data-coach-title]").innerText();
  const firstHref = await page.getByRole("link", { name: /^(Review article|Open this move)$/ }).getAttribute("href");
  expect(firstHref).toContain(`site=${fixture.mvp.websiteId}`);
  if (width === 390) {
    const action = await page.getByRole("link", { name: /^(Review article|Open this move)$/ }).boundingBox();
    expect(action).not.toBeNull();
    expect(action!.y + action!.height).toBeLessThan(780);
  }
  await expect(page.getByRole("heading", { name: "What done looks like" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/glaze|pottery|5-minute|Since your last visit/i);
  const swap = page.getByRole("button", { name: "See another move", exact: true });
  await expect(swap).toBeVisible();
  await swap.click();
  await expect(page.locator("[data-coach-title]")).not.toHaveText(firstTitle);
  const mobile = testInfo.project.name === "mobile";
  if (mobile) await page.getByRole("button", { name: "Open navigation", exact: true }).click();
  const tools = page.getByRole("navigation", { name: "All tools", exact: true });
  await expect(tools).toBeVisible();
  for (const link of await tools.getByRole("link").all()) {
    expect(await link.getAttribute("href")).toContain(`site=${fixture.mvp.websiteId}`);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  if (mobile) await page.keyboard.press("Escape");
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? ""))).toEqual([]);
  await page.getByRole("link", { name: "Open full workspace", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`view=dashboard&site=${fixture.mvp.websiteId}`));
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Home", exact: true })).toBeVisible();
  await expect(page.locator("[data-queue-item]").first().locator("strong")).toHaveText(firstTitle);
  await page.getByRole("link", { name: "Back to your coach", exact: false }).click();
  await expect(page.locator('[data-coach-home="warmup"]')).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/app/home\\?site=${fixture.mvp.websiteId}$`));
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1, name: "Home", exact: true })).toBeVisible();
  if (mobile) await page.getByRole("button", { name: "Open navigation", exact: true }).click();
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Coach", exact: true }).click();
  await expect(page.locator('[data-coach-home="warmup"]')).toBeVisible();
  if (mobile) await page.getByRole("button", { name: "Open navigation", exact: true }).click();
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Home dashboard", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Home", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Back to your coach", exact: false }).click();
  await expect(page.locator('[data-coach-home="warmup"]')).toBeVisible();
  expect(writes).toEqual([]);
  if (mobile) await page.getByRole("button", { name: "Open navigation", exact: true }).click();
  await page.getByLabel(/Current website:.*Choose another website/).filter({ visible: true }).click();
  await page.locator(`[data-site-switch="${fixture.alpha.websiteId}"]`).filter({ visible: true }).click();
  await expect(page).toHaveURL(new RegExp(`site=${fixture.alpha.websiteId}`));
  await expect(page.locator('[data-coach-home="warmup"]')).toBeVisible();
  expect(errors).toEqual([]);
});
