import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const fixturePath = process.env.QA_LOCAL_BROWSER_FIXTURE;
const fixture = fixturePath ? JSON.parse(readFileSync(fixturePath, "utf8")) as { mvp: { websiteId: string } } : null;

test("@gate navigation controls remain reachable at tablet widths and in the mobile drawer", async ({ page }, testInfo) => {
  if (!fixture) throw new Error("Disposable browser fixture is required.");
  await page.goto(`/app/home?site=${fixture.mvp.websiteId}`);
  if (testInfo.project.name === "mobile") {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/keywords?site=${fixture.mvp.websiteId}`);
    await page.evaluate(() => window.scrollTo(0, 650));
    const header = await page.locator('[class*="mobilebar"]').boundingBox();
    expect(header?.y).toBe(0);
    const trigger = page.getByRole("button", { name: "Open navigation", exact: true });
    const sidebar = page.getByRole("complementary", { name: "Workspace navigation" });
    await trigger.click();
    await expect(sidebar.getByRole("button", { name: "Close navigation", exact: true })).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(sidebar.getByRole("button", { name: "Sign out", exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(sidebar.getByRole("button", { name: "Close navigation", exact: true })).toBeFocused();
    await page.getByRole("button", { name: "Close navigation backdrop", exact: true }).click({ position: { x: 385, y: 400 } });
    await expect(sidebar).not.toBeVisible();
    await expect(trigger).toBeFocused();
  } else {
    for (const width of [801, 1000, 1200]) {
      await page.setViewportSize({ width, height: 1000 });
      const access = page.getByRole("link", { name: "Open full workspace", exact: true });
      const box = await access.boundingBox();
      expect(box).not.toBeNull();
      const unobstructed = await access.evaluate(node => {
        const r = node.getBoundingClientRect();
        return node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      });
      expect(unobstructed, `workspace link at ${width}px`).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      const title = await page.getByRole("heading", { name: "Your coach", exact: true }).boundingBox();
      expect(title).not.toBeNull();
      expect(box!.x >= title!.x + title!.width || box!.y >= title!.y + title!.height || box!.y + box!.height <= title!.y).toBe(true);
    }
  }
});
