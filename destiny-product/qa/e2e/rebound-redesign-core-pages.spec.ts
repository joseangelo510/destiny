import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

type BrowserFixture = { mvp: { draftId: string; websiteId: string } };
const fixturePath = process.env.QA_LOCAL_BROWSER_FIXTURE;
const fixture = fixturePath ? JSON.parse(readFileSync(fixturePath, "utf8")) as BrowserFixture : null;

function requireFixture() {
  if (!fixture) throw new Error("Run pnpm qa:browser-fixture against disposable local Supabase first.");
  return fixture;
}

async function verifyPageHealth(page: Page, mobile: boolean, consoleErrors: string[], pageErrors: string[]) {
  await expect(page.locator('[data-rebound-core="v1"]')).toBeVisible();
  await expect(page.getByText("Preview — read-only.")).toBeVisible();
  for (const href of ["/app/home", "/app/content", "/app/calendar", "/app/distribution", "/app/progress"]) {
    await expect(page.locator(`a[href^="${href}"]`).first()).toBeAttached();
  }
  expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(mobile ? 390 : 1360);
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? ""))).toEqual([]);
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
}

test.describe("@gate Rebound redesign read-only core pages", () => {
  for (const expected of [
    { route: "content", heading: "Content", landmark: "Content pipeline" },
    { route: "calendar", heading: "Calendar", landmark: "The month" },
    { route: "distribution", heading: "Distribution", landmark: "Waiting for saved data" },
    { route: "progress", heading: "Progress", landmark: "What needs to be done" },
  ]) {
    test(`${expected.route} renders real scoped evidence without new write actions`, async ({ page }, testInfo) => {
      const activeFixture = requireFixture();
      const mobile = testInfo.project.name === "mobile";
      await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1360, height: 1000 });
      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];
      page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
      page.on("pageerror", (error) => pageErrors.push(error.message));

      const response = await page.goto(`/app/${expected.route}?site=${activeFixture.mvp.websiteId}`, { waitUntil: "networkidle" });
      expect(response?.status()).toBe(200);
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.getByRole("heading", { level: 1, name: expected.heading })).toBeVisible();
      if (expected.route === "content") await expect(page.getByRole("region", { name: expected.landmark })).toBeVisible();
      else await expect(page.getByText(expected.landmark, { exact: true }).first()).toBeVisible();
      await expect(page.locator("body")).not.toContainText(/Approve all|Publish now|Send as report|Request edits/i);
      await verifyPageHealth(page, mobile, consoleErrors, pageErrors);

      if (process.env.QA_CAPTURE_REBOUND_SCREENSHOTS === "1") {
        const viewport = mobile ? "mobile-390x844" : "desktop-1360x1000";
        await page.screenshot({ path: resolve(process.cwd(), "../docs/design/redesign-v1/screenshots", `${expected.route}-actual-${viewport}.png`), fullPage: false });
      }
    });
  }

  test("draft detail enables only the governed approval path", async ({ page }, testInfo) => {
    const activeFixture = requireFixture();
    const mobile = testInfo.project.name === "mobile";
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1360, height: 1000 });
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const draftWrites: string[] = [];
    page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("request", (request) => {
      if (request.method() === "PUT" && request.url().includes("/api/content/drafts")) draftWrites.push(request.url());
    });

    const response = await page.goto(`/app/content/${activeFixture.mvp.draftId}?site=${activeFixture.mvp.websiteId}`, { waitUntil: "networkidle" });
    expect(response?.status()).toBe(200);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { level: 1, name: "Content" })).toBeVisible();
    await expect(page.getByText("Preview — draft approval enabled.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Fix issues before approval" })).toBeDisabled();
    const editLink = page.getByRole("link", { name: "Edit in Content Studio" });
    await expect(editLink).toHaveAttribute("href", `/content?site=${activeFixture.mvp.websiteId}#article-review-workspace`);
    await expect(page.locator("body")).not.toContainText("Request edits");
    expect(draftWrites).toEqual([]);
    expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(mobile ? 390 : 1360);
    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(accessibility.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? ""))).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);

    if (process.env.QA_CAPTURE_REBOUND_SCREENSHOTS === "1") {
      const viewport = mobile ? "mobile-390x844" : "desktop-1360x1000";
      await page.screenshot({ path: resolve(process.cwd(), "../docs/design/redesign-v1/screenshots", `content-draft-actions-${viewport}.png`), fullPage: false });
    }
  });
});
