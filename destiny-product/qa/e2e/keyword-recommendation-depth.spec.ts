import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
const fixture = JSON.parse(readFileSync(process.env.QA_LOCAL_BROWSER_FIXTURE!, "utf8"));
test("@gate fifteen recommendations expand independently and retain the website during further discovery", async ({ page }, testInfo) => {
  const { websiteId } = fixture.keywordDepthWorkspaces[testInfo.project.name];
  await page.goto(`/keywords?site=${websiteId}`);
  const section = page.getByRole("region", { name: "New keyword recommendations", exact: true });
  await expect(section.getByRole("button", { name: "Add to content plan", exact: true })).toHaveCount(15);
  const existingRows = await page.locator('table').nth(1).getByRole('row').count();
  await section.getByRole("button", { name: "Show 15 more" }).click();
  await expect(section.getByRole("button", { name: "Add to content plan", exact: true })).toHaveCount(30);
  expect(await page.locator('table').nth(1).getByRole('row').count()).toBe(existingRows);
  await section.getByRole("button", { name: "Show 1 more" }).click();
  await expect(section.getByRole("button", { name: "Add to content plan", exact: true })).toHaveCount(31);
  // Discovery must reach the server with the new batch, even when the router
  // has cached this pathname. A hash-only client transition can reuse round zero.
  const discoveryRequest = page.waitForRequest(request => request.isNavigationRequest()
    && new URL(request.url()).pathname === "/keywords"
    && new URL(request.url()).searchParams.get("discover") === "1", { timeout: 10000 });
  await section.getByRole("link", { name: /Discover more recommendations/ }).click();
  await discoveryRequest;
  await expect(page).toHaveURL(new RegExp(`site=${websiteId}&discover=1`));
  await expect(section.getByRole("button", { name: "Add to content plan", exact: true })).toHaveCount(31);
  await expect(section.getByText(/Additional research is temporarily unavailable/)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath(`keyword-depth-${testInfo.project.name}.png`), fullPage: true });
});
