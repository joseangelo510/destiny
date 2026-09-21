import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { parseKeywordRows, summarizeKeywordRows } from "../../supabase/functions/seo-research/logic";

const path = process.env.QA_LOCAL_BROWSER_FIXTURE;
if (!path) throw new Error("Disposable fixture required for keyword metric verification.");
const fixture = JSON.parse(readFileSync(path, "utf8")) as { mvp: { websiteId: string } };

test("@gate missing metrics remain distinct from zero in summaries, sorting and CSV", async ({ page }) => {
  const rows = parseKeywordRows({ status_code: 20000, tasks: [{ status_code: 20000, result: [{ items: [
    { keyword: "known positive", keyword_info: { search_volume: 100, cpc: 1.25, competition: 0.5 }, keyword_properties: { keyword_difficulty: 20 } },
    { keyword: "measured zero", keyword_info: { search_volume: 0, cpc: 0, competition: 0 }, keyword_properties: { keyword_difficulty: 0 } },
    { keyword: "unknown metrics" },
  ] }] }] });
  await page.route("**/api/research/keywords", async route => {
    const { query, mode, metricContractVersion } = route.request().postDataJSON();
    expect(metricContractVersion).toBe(2);
    await route.fulfill({ json: { query, mode, sourceLabel: "Synthetic provider contract fixture", location: "United States", updatedAt: "2026-09-21T20:00:00Z", metrics: summarizeKeywordRows(rows, 399), rows, notices: ["Synthetic metrics fixture."] } });
  });
  await page.goto(`/keyword-research?site=${fixture.mvp.websiteId}`);
  const panel = page.locator(".research-search-panel");
  await panel.getByRole("button", { name: "Keyword", exact: true }).click();
  await panel.getByLabel("Keyword phrase").fill("metric fixture");
  await panel.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByRole("heading", { name: "metric fixture", exact: true })).toBeVisible();
  const metrics = page.locator(".research-metric-grid article");
  await expect(metrics.filter({ hasText: "Average difficulty" })).toContainText("10");
  await expect(metrics.filter({ hasText: "Average difficulty" })).toContainText("2 of 3 rows report difficulty");
  await expect(metrics.filter({ hasText: "Estimated traffic" })).toContainText("Not available");
  const tableRows = page.locator(".research-table tbody tr");
  const zeroCells = tableRows.filter({ hasText: "measured zero" }).getByRole("cell");
  await expect(zeroCells.nth(2)).toHaveText("0");
  await expect(zeroCells.nth(4)).toHaveText("0");
  await expect(zeroCells.nth(5)).toHaveText("$0.00");
  await expect(zeroCells.nth(6)).toHaveText("0%");
  const unknownCells = tableRows.filter({ hasText: "unknown metrics" }).getByRole("cell");
  for (const index of [2, 4, 5, 6]) await expect(unknownCells.nth(index)).toHaveText("Not available");
  await page.getByRole("button", { name: /Sort by Volume/ }).click();
  await expect(tableRows.first()).toContainText("measured zero");
  await expect(tableRows.last()).toContainText("unknown metrics");
  await page.getByRole("button", { name: /Sort by Volume/ }).click();
  await expect(tableRows.first()).toContainText("known positive");
  await expect(tableRows.last()).toContainText("unknown metrics");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  const download = await downloadPromise;
  const csv = readFileSync((await download.path())!, "utf8");
  expect(csv).toContain('"measured zero","unknown","0","0","0","0"');
  expect(csv).toContain('"unknown metrics","unknown","","","",""');
});
