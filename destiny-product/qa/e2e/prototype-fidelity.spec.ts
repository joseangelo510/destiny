import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const fixturePath = process.env.QA_LOCAL_BROWSER_FIXTURE;
const fixture = fixturePath ? JSON.parse(readFileSync(fixturePath, "utf8")) as { mvp: { websiteId: string } } : null;

test("@gate the approved prototype shell follows every tool and preserves site-scoped navigation", async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  if (!fixture) throw new Error("Disposable browser fixture required.");
  const mobile = testInfo.project.name === "mobile";
  const width = mobile ? 390 : 1210;
  await page.setViewportSize({ width, height: mobile ? 844 : 1000 });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const routes = ["/app/home", "/app/home?view=dashboard", "/app/content", "/app/calendar", "/app/distribution", "/app/progress", "/distribution", "/this-week", "/roadmap", "/results", "/analytics", "/audits", "/internal-links", "/content", "/interviews", "/content/repurpose", "/content/infographics", "/keywords", "/keyword-research", "/domain-overview", "/rank-tracker", "/backlinks", "/reviews", "/integrations", "/llm-visibility", "/account"];
  for (const route of routes) {
    const response = await page.goto(`${route}${route.includes("?") ? "&" : "?"}site=${fixture.mvp.websiteId}`);
    expect(response?.status(), route).toBe(200);
    const navigation = page.locator('[data-approved-navigation="preservation"]');
    await expect(navigation).toHaveCount(1);
    if (route === "/this-week") {
      const reveal = page.getByRole("button", { name: "Close plan reveal", exact: true });
      if (await reveal.isVisible()) await reveal.click();
    }
    if (mobile) await page.getByRole("button", { name: "Open navigation", exact: true }).click();
    const sidebar = page.getByRole("complementary", { name: "Workspace navigation" });
    await expect(sidebar).toBeVisible();
    const main = sidebar.getByRole("navigation", { name: "Main navigation" });
    expect(await main.getByRole("link").allTextContents()).toEqual(["Home dashboard", "Coach", "Content", "Calendar", "Distribution", "Progress"]);
    const tools = sidebar.getByRole("navigation", { name: "All tools" });
    expect(await tools.locator("a").count()).toBe(19);
    expect(await sidebar.getByRole("navigation", { name: "Account and connections" }).getByRole("link").count()).toBe(2);
    for (const link of await sidebar.getByRole("navigation").locator("a").all()) {
      expect(await link.getAttribute("href")).toContain(`site=${fixture.mvp.websiteId}`);
    }
    const styles = await sidebar.evaluate(node => ({ width: node.getBoundingClientRect().width, background: getComputedStyle(node).backgroundColor, font: getComputedStyle(node).fontFamily }));
    expect(styles.background).toBe("rgb(24, 15, 21)");
    expect(styles.font).toContain("Archivo");
    if (!mobile) expect(styles.width).toBe(265);
    if (mobile) {
      await page.keyboard.press("Escape");
      await expect(sidebar).not.toBeVisible();
      await expect(page.getByRole("button", { name: "Open navigation", exact: true })).toBeFocused();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth), route).toBeLessThanOrEqual(width);
    if (route === "/app/home") {
      const action = page.locator('[data-coach-home] [class*="actions"] a').first();
      await expect(action).toBeVisible();
      expect(await action.evaluate(node => getComputedStyle(node).backgroundColor)).toBe("rgb(231, 25, 78)");
      expect(await action.evaluate(node => node.getBoundingClientRect().bottom)).toBeLessThan(mobile ? 844 : 1000);
    }
    await page.screenshot({ path: testInfo.outputPath(`${route.replaceAll(/[^a-z0-9]/gi,"-")}.png`), fullPage: true });
  }
  expect(errors).toEqual([]);
});
