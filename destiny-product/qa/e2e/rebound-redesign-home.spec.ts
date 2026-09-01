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

    const mobileNavigation = page.getByRole("navigation", { name: "Core mobile navigation" });
    if (mobile) {
      await expect(mobileNavigation).toBeVisible();
      expect(await mobileNavigation.locator(":scope > *").count()).toBe(5);
    } else {
      await expect(mobileNavigation).toBeHidden();
      await expect(page.getByRole("navigation", { name: "Existing Rebound SEO tools" })).toBeVisible();
      for (const label of ["Website audits", "Content studio", "Keyword strategy", "Rank tracker", "Distribution", "Connections"]) {
        await expect(page.getByRole("link", { name: label, exact: true }).first()).toBeAttached();
      }
    }

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
