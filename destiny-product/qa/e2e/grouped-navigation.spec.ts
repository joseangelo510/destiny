import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
const file = process.env.QA_LOCAL_BROWSER_FIXTURE;
const fixture = file ? JSON.parse(readFileSync(file, "utf8")) : null;

test("@gate grouped tools preserve desktop and mobile navigation", async ({page}, info) => {
  if (!fixture) throw new Error("Disposable fixture required");
  const mobile = info.project.name === "mobile";
  await page.setViewportSize({width: mobile ? 390 : 1440, height: mobile ? 844 : 1024});
  const errors: string[] = []; page.on("pageerror", e=>errors.push(e.message));
  await page.goto(`/domain-overview?site=${fixture.mvp.websiteId}`);
  const sidebar = page.getByRole("complementary", {name:"Workspace navigation"});
  const reveal = async () => { if (mobile) await page.getByRole("button",{name:"Open navigation",exact:true}).click(); };
  await reveal();
  const groups = sidebar.locator("details[data-tool-group]");
  await expect(groups).toHaveCount(7);
  await expect(sidebar.locator('details[data-tool-group][open]')).toHaveCount(1);
  await expect(sidebar.getByRole("link",{name:"Domain Overview",exact:true})).toHaveAttribute("aria-current","page");
  await page.screenshot({path:info.outputPath("grouped-navigation.png"),fullPage:false});
  const keywords = sidebar.locator('details[data-tool-group="Keywords"]');
  await keywords.locator("summary").focus(); await page.keyboard.press("Enter");
  await expect(keywords).toHaveAttribute("open","");
  await keywords.getByRole("link",{name:"Keyword research",exact:true}).click();
  await expect(page).toHaveURL(new RegExp(`/keyword-research\\?site=${fixture.mvp.websiteId}$`));
  if (mobile) await expect(sidebar).not.toBeVisible();
  await reveal();
  await expect(sidebar.locator('details[data-tool-group="Keywords"]')).toHaveAttribute("open","");
  await expect(sidebar.locator('details[data-tool-group="Competitor research"]')).not.toHaveAttribute("open","");
  for (const group of await groups.all()) {
    if (!(await group.getAttribute("open") === "")) await group.locator("summary").click();
    for (const link of await group.getByRole("link").all()) expect(await link.getAttribute("href")).toContain(`site=${fixture.mvp.websiteId}`);
  }
  const footer = sidebar.getByRole("navigation",{name:"Account and connections",exact:true});
  await expect(footer.getByRole("link",{name:"Account",exact:true})).toBeInViewport();
  await expect(footer.getByRole("link",{name:"Connections",exact:true})).toBeInViewport();
  if (mobile) {
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button",{name:"Open navigation",exact:true})).toBeFocused();
    await reveal();
    await page.getByRole("button",{name:"Close navigation backdrop",exact:true}).click({position:{x:370,y:400}});
    await expect(sidebar).not.toBeVisible();
    await reveal();
  }
  await footer.getByRole("link",{name:"Connections",exact:true}).click();
  await expect(page).toHaveURL(new RegExp(`/integrations\\?site=${fixture.mvp.websiteId}$`));
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(mobile ? 390 : 1440);
  expect(errors).toEqual([]);
});
