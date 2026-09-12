import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

type BrowserFixture = { mvp: { websiteId: string } };
const fixturePath = process.env.QA_LOCAL_BROWSER_FIXTURE;
const fixture = fixturePath ? JSON.parse(readFileSync(fixturePath, "utf8")) as BrowserFixture : null;

function requireFixture() {
  if (!fixture) throw new Error("Run pnpm qa:browser-fixture against disposable local Supabase first.");
  return fixture;
}

test.describe("@gate Rebound redesign read-only Home", () => {
  test("renders the authenticated, website-scoped Home contract at the approved viewport", async ({ page }, testInfo) => {
    const activeFixture = requireFixture();
    const mobile = testInfo.project.name === "mobile";
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1360, height: 1000 });
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
    page.on("pageerror", (error) => pageErrors.push(error.message));

    const response = await page.goto(`/app/home?site=${activeFixture.mvp.websiteId}`, { waitUntil: "networkidle" });
    expect(response?.status()).toBe(200);
    await expect(page).not.toHaveURL(/\/login/);
    await page.getByRole("link", { name: "Open full workspace", exact: true }).click();
    await expect(page.locator('[data-rebound-core="v1"]')).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();
    await expect(page.getByText("Preview — read-only.")).toBeVisible();

    const sessionTitle = await page.locator("[data-session-title]").innerText();
    await expect(page.locator("[data-queue-item]").first().locator("strong")).toHaveText(sessionTitle);
    await expect(page.getByRole("heading", { name: "How your SEO is doing" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Keywords" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Competitors" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "The month" })).toBeVisible();

    for (const href of ["/app/content", "/app/calendar", "/app/distribution", "/app/progress"]) {
      await expect(page.locator(`a[href^="${href}"]`).first()).toBeAttached();
    }
    await expect(page.locator("body")).not.toContainText(/Maya.?s Pottery|ClayCraft|pottery glaze|kiln guide/i);
    expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(mobile ? 390 : 1360);

    if (mobile) await page.getByRole("button", { name: "Open navigation", exact: true }).click();
    const navigation = page.getByRole("navigation", { name: "Main navigation", exact: true });
    await expect(navigation).toBeVisible();
    expect(await navigation.getByRole("link").count()).toBe(6);
    const tools = page.getByRole("navigation", { name: "All tools", exact: true });
    await expect(tools).toBeVisible();
    for (const label of ["Website audits", "Content studio", "Keyword strategy", "Rank tracker", "Distribution tools"]) {
      await expect(tools.getByRole("link", { name: label, exact: true, includeHidden: true })).toBeAttached();
    }
    await expect(page.getByRole("navigation", { name: "Account and connections" }).getByRole("link", { name: "Connections", exact: true })).toBeVisible();
    if (mobile) await page.keyboard.press("Escape");

    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(accessibility.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? ""))).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);

    if (process.env.QA_CAPTURE_REBOUND_SCREENSHOTS === "1") {
      const name = mobile ? "home-actual-mobile-390x844.png" : "home-actual-desktop-1360x1000.png";
      await page.screenshot({ path: resolve(process.cwd(), "../docs/design/redesign-v1/screenshots", name), fullPage: false });
    }
  });
});
