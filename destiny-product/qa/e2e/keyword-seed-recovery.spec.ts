import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { parseKeywordRows, summarizeKeywordRows } from "../../supabase/functions/seo-research/logic";
const fixturePath = process.env.QA_LOCAL_BROWSER_FIXTURE;
if (!fixturePath) throw new Error("Disposable browser fixture required.");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as { mvp: { websiteId: string } };

test("@gate an exact seed-only result and separately measured variant remain visible", async ({page}) => {
  let searches = 0;
  await page.route("**/api/research/keywords", async route => {
    const {query,mode} = route.request().postDataJSON();
    const rows = parseKeywordRows({status_code:20000,tasks:[{status_code:20000,result:[{
      seed_keyword_data:{keyword:query,keyword_info:{search_volume:40},keyword_properties:{keyword_difficulty:0}},
      items: searches++ === 0 ? [] : [{keyword:"is chatgpt spying on you",keyword_info:{search_volume:20}}],
    }]}]});
    await route.fulfill({json:{query,mode,sourceLabel:"Synthetic exact-seed fixture",location:"United States",updatedAt:"2026-09-21T21:00:00Z",metricContractVersion:2,metrics:summarizeKeywordRows(rows),rows,notices:["Synthetic data; not measured provider volume."]}});
  });
  await page.goto(`/keyword-research?site=${fixture.mvp.websiteId}`);
  const panel=page.locator(".research-search-panel");
  await panel.getByRole("button",{name:"Keyword",exact:true}).click();
  await panel.getByLabel("Keyword phrase").fill("is chatgpt spying on me");
  await panel.getByRole("button",{name:"Search",exact:true}).click();
  const rows=page.locator(".research-table tbody tr");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("is chatgpt spying on me");
  await expect(rows.first().getByRole("cell").nth(2)).toHaveText("40");
  await panel.getByRole("button",{name:"Search",exact:true}).click();
  await expect(rows).toHaveCount(2);
  await expect(rows.filter({hasText:"is chatgpt spying on me"}).getByRole("cell").nth(2)).toHaveText("40");
  await expect(rows.filter({hasText:"is chatgpt spying on you"}).getByRole("cell").nth(2)).toHaveText("20");
});
