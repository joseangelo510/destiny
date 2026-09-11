import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const fixturePath = process.env.QA_LOCAL_BROWSER_FIXTURE;
const fixture = fixturePath ? JSON.parse(readFileSync(fixturePath, "utf8")) as { mvp: { websiteId: string } } : null;

test("@gate the preserved tools retain their complete pages under the new brand", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  if (!fixture) throw new Error("Disposable browser fixture is required.");
  const width = testInfo.project.name === "mobile" ? 390 : 1360;
  await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
  const writes: string[] = [];
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("request", (request) => { if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) writes.push(request.url()); });
  const pages = ["/app/home", "/app/home?view=dashboard", "/app/content", "/app/calendar", "/app/distribution", "/app/progress", "/keywords", "/content", "/reviews", "/integrations"];
  for (const path of pages) {
    const response = await page.goto(`${path}${path.includes("?") ? "&" : "?"}site=${fixture.mvp.websiteId}`);
    expect(response?.status(), path).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth), path).toBeLessThanOrEqual(width);
    const font = await page.getByRole("heading", { level: 1 }).evaluate((node) => getComputedStyle(node).fontFamily);
    expect(font, path).toContain("Archivo");
    if (path === "/reviews") {
      await expect(page.getByRole("link", { name: "Manage Google connection" })).toBeVisible();
      for (const provider of ["Google Business Profile", "Yelp", "Apple Maps", "Product Hunt", "G2", "Capterra"]) {
        await expect(page.locator("#directory-registry")).toContainText(provider);
      }
    }
    if (path === "/integrations") {
      for (const provider of ["Google Search Console", "Google Analytics", "Google Business Profile", "YouTube", "WordPress", "Webflow"]) {
        await expect(page.locator("main")).toContainText(provider);
      }
    }
    if (path === "/content") await expect(page.locator("#publishing-plan")).toBeVisible();
    if (process.env.QA_CAPTURE_COACH === "1") {
      await page.screenshot({ path: testInfo.outputPath(`${path.replaceAll(/[^a-z0-9]/gi, "-")}.png`), fullPage: true });
    }
  }
  expect(writes).toEqual([]);
  expect(failures).toEqual([]);
});
