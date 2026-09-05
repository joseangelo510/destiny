import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const fixturePath = process.env.QA_LOCAL_BROWSER_FIXTURE;
const fixture = fixturePath ? JSON.parse(readFileSync(fixturePath, "utf8")) as { mvp: { websiteId: string } } : null;
const coreTabs = ["Home", "Content", "Calendar", "Distribution", "Progress"];

test.describe("@gate core navigation from returning-user entry and existing tools", () => {
  test("default workspace and returning onboarding land on the shipped Home", async ({ page }) => {
    if (!fixture) throw new Error("Disposable browser fixture is required.");
    await page.goto(`/app?site=${fixture.mvp.websiteId}`);
    await expect(page).toHaveURL(new RegExp(`/app/home\\?site=${fixture.mvp.websiteId}$`));
    await expect(page.getByRole("heading", { level: 1, name: "Home", exact: true })).toBeVisible();
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/app\/home\?site=/);
    await expect(page.getByRole("heading", { level: 1, name: "Home", exact: true })).toBeVisible();
  });

  test("existing tools retain all five tabs and return to the same website", async ({ page }, testInfo) => {
    if (!fixture) throw new Error("Disposable browser fixture is required.");
    const mobile = testInfo.project.name === "mobile";
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1360, height: 1000 });
    const serverErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on("response", (response) => { if (response.status() >= 500) serverErrors.push(response.url()); });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    for (const tool of ["/content/infographics", "/keywords"]) {
      await page.goto(`${tool}?site=${fixture.mvp.websiteId}`);
      const navigation = page.getByRole("navigation", { name: mobile ? "Primary mobile navigation" : "Rebound SEO workspace", exact: true });
      await expect(navigation).toBeVisible();
      for (const label of coreTabs) {
        const link = navigation.getByRole("link", { name: label, exact: true });
        await expect(link).toBeVisible();
        await expect(link).toHaveAttribute("href", `/app/${label.toLowerCase()}?site=${fixture.mvp.websiteId}`);
      }
      const overflow = await page.evaluate(() => [...document.querySelectorAll("body *")].filter((element) => element.getBoundingClientRect().right > innerWidth + 1).slice(0, 12).map((element) => ({ tag: element.tagName, class: element.className, right: element.getBoundingClientRect().right })));
      expect(await page.evaluate(() => document.documentElement.scrollWidth), JSON.stringify(overflow)).toBeLessThanOrEqual(mobile ? 390 : 1360);
      await navigation.getByRole("link", { name: "Home", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/app/home\\?site=${fixture.mvp.websiteId}$`));
      await expect(page.getByRole("heading", { level: 1, name: "Home", exact: true })).toBeVisible();
    }
    expect(serverErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
