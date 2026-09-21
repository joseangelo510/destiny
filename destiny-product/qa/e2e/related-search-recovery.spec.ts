import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { parseKeywordSerp } from "../../supabase/functions/seo-research/logic";

const fixturePath = process.env.QA_LOCAL_BROWSER_FIXTURE;
if (!fixturePath) throw new Error("Disposable browser fixture is required for related-search certification.");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as { mvp: { websiteId: string } };

test("@gate documented related strings can be researched and saved after revisit", async ({ page }, testInfo) => {
  const seed = "synthetic screening question";
  const related = `synthetic ${testInfo.project.name} screening timing ${Date.now()}`;
  const checkedAt = new Date("2026-09-21T19:00:00Z");
  const requested: string[] = [];
  await page.route("**/api/research/keywords", async route => {
    const { query, mode } = route.request().postDataJSON();
    requested.push(query);
    // The real parser consumes the documented string-array provider shape.
    const snapshot = parseKeywordSerp({ status_code: 20000, tasks: [{ status_code: 20000, result: [{ items: [
      { type: "related_searches", items: [related] },
    ] }] }] }, query, "United States", checkedAt);
    await route.fulfill({ json: {
      query, mode, location: snapshot.location, sourceLabel: "Synthetic provider contract fixture",
      updatedAt: snapshot.checkedAt, serpCheckedAt: snapshot.checkedAt, serpEvidenceStatus: "live",
      questions: snapshot.questions, related: snapshot.related, notices: ["Synthetic provider fixture; saving uses the disposable database."],
      metrics: { totalKeywords: 1, totalVolume: 10, averageDifficulty: 5, estimatedTraffic: 0 },
      rows: [{ keyword: query, intent: "informational", volume: 10, difficulty: 5, cpc: 0, competition: 0, trend: [], position: 0, traffic: 0, url: "" }],
    } });
  });
  const research = async () => {
    const panel = page.locator(".research-search-panel");
    await panel.getByRole("button", { name: "Keyword", exact: true }).click();
    await panel.getByLabel("Keyword phrase").fill(seed);
    await panel.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.getByRole("heading", { name: seed, exact: true })).toBeVisible();
  };
  await page.goto(`/keyword-research?site=${fixture.mvp.websiteId}`);
  await research();
  const card = page.locator(".keyword-insight-card").filter({ hasText: "Other keyword opportunities" });
  const suggestion = card.getByRole("listitem").filter({ hasText: related });
  await expect(suggestion).toBeVisible();
  await suggestion.getByRole("button", { name: "Research this", exact: true }).click();
  await expect(page.getByRole("heading", { name: related, exact: true })).toBeVisible();
  expect(requested).toEqual([seed, related]);
  await expect(page).toHaveURL(new RegExp(`site=${fixture.mvp.websiteId}`));
  await suggestion.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByLabel("Save keywords to a list").getByRole("button", { name: "Save keywords", exact: true }).click();
  await expect(suggestion.getByRole("button", { name: "Saved to General ✓", exact: true })).toBeDisabled();
  await page.reload();
  await research();
  await expect(suggestion.getByRole("button", { name: "Saved to General ✓", exact: true })).toBeDisabled();
});
