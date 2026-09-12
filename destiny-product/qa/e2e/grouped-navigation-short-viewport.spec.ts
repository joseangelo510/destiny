import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

test("@gate short screens keep sidebar tools and bottom controls reachable", async ({ page }, info) => {
  const file = process.env.QA_LOCAL_BROWSER_FIXTURE;
  if (!file) throw new Error("Disposable fixture required");
  const fixture = JSON.parse(readFileSync(file, "utf8"));
  const mobile = info.project.name === "mobile";
  await page.setViewportSize({ width: mobile ? 375 : 1000, height: 600 });
  await page.goto(`/domain-overview?site=${fixture.mvp.websiteId}`);
  if (mobile) await page.getByRole("button", { name: "Open navigation", exact: true }).click();
  const sidebar = page.getByRole("complementary", { name: "Workspace navigation" });
  const signout = sidebar.getByRole("button", { name: "Sign out", exact: true });
  await signout.scrollIntoViewIfNeeded();
  await expect(signout).toBeInViewport();
  await expect(signout).toBeVisible();
  expect(await signout.evaluate(node => {
    const r = node.getBoundingClientRect();
    return node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  })).toBe(true);
  const planning = sidebar.locator('details[data-tool-group="Planning"]');
  await planning.locator("summary").click();
  const link = planning.getByRole("link").last();
  await link.scrollIntoViewIfNeeded();
  await expect(link).toBeInViewport();
  await page.screenshot({ path: info.outputPath("short-sidebar.png"), fullPage: false });
});
