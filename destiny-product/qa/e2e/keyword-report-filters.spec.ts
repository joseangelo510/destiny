import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const fixturePath = process.env.QA_LOCAL_BROWSER_FIXTURE;
if (!fixturePath) throw new Error("Disposable browser fixture is required for keyword filter certification.");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as { mvp: { websiteId: string } };

function report(query: string, mode: string, keyword: string, intent: string) {
  return {
    query, mode, location: "United States", sourceLabel: "Synthetic filter regression fixture",
    updatedAt: "2026-09-21T19:00:00Z", questions: [], related: ["is chatgpt spying on you"], notices: [], serpEvidenceStatus: "live",
    metrics: { totalKeywords: 1, totalVolume: 20, averageDifficulty: 22, estimatedTraffic: 0 },
    rows: [{ keyword, intent, volume: 20, difficulty: 22, cpc: 0, competition: 0, trend: [], position: 0, traffic: 0, url: "" }],
  };
}

test.describe("@gate keyword report filter recovery", () => {
  for (const targetMode of ["keyword", "domain", "related suggestion"] as const) {
    test(`clears stale text and intent filters after successful ${targetMode} research`, async ({ page }) => {
      const nextQuery = targetMode === "domain" ? "example.org" : "is chatgpt spying on you";
      await page.route("**/api/research/keywords", async route => {
        const { query, mode } = route.request().postDataJSON();
        await route.fulfill({ json: report(query, mode, query === nextQuery ? "is chatgpt spying on you" : "employment background check", query === nextQuery ? "informational" : "commercial") });
      });
      await page.goto(`/keyword-research?site=${fixture.mvp.websiteId}`);
      const panel = page.locator(".research-search-panel");
      await panel.getByRole("button", { name: "Keyword", exact: true }).click();
      await panel.getByLabel("Keyword phrase").fill("employment background check");
      await panel.getByRole("button", { name: "Search", exact: true }).click();
      await expect(page.getByRole("row", { name: /^employment background check commercial/ })).toBeVisible();
      await page.getByLabel("Filter keywords", { exact: true }).fill("background");
      await page.getByLabel("Filter by intent").selectOption("commercial");
      if (targetMode === "domain") await panel.getByRole("button", { name: "Domain", exact: true }).click();
      if (targetMode === "related suggestion") {
        await page.getByRole("button", { name: "Research this", exact: true }).click();
      } else {
        await panel.getByLabel(targetMode === "domain" ? "Domain" : "Keyword phrase", { exact: true }).fill(nextQuery);
        await panel.getByRole("button", { name: "Search", exact: true }).click();
      }
      await expect(page.getByRole("heading", { name: nextQuery, exact: true })).toBeVisible();
      await expect(page.getByLabel("Filter keywords", { exact: true })).toHaveValue("");
      await expect(page.getByLabel("Filter by intent")).toHaveValue("all");
      await expect(page.getByRole("row", { name: /^is chatgpt spying on you informational 20/ })).toBeVisible();
    });
  }

  test("preserves the prior report and filters after failed research", async ({ page }) => {
    await page.route("**/api/research/keywords", async route => {
      const { query, mode } = route.request().postDataJSON();
      await route.fulfill(query === "unavailable query"
        ? { status: 503, json: { error: "Synthetic provider unavailable" } }
        : { json: report(query, mode, "employment background check", "commercial") });
    });
    await page.goto(`/keyword-research?site=${fixture.mvp.websiteId}`);
    const panel = page.locator(".research-search-panel");
    await panel.getByRole("button", { name: "Keyword", exact: true }).click();
    await panel.getByLabel("Keyword phrase").fill("employment background check");
    await panel.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.getByRole("row", { name: /^employment background check commercial/ })).toBeVisible();
    await page.getByLabel("Filter keywords", { exact: true }).fill("background");
    await page.getByLabel("Filter by intent").selectOption("commercial");
    await panel.getByLabel("Keyword phrase").fill("unavailable query");
    await panel.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.getByText("Synthetic provider unavailable", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Filter keywords", { exact: true })).toHaveValue("background");
    await expect(page.getByLabel("Filter by intent")).toHaveValue("commercial");
    await expect(page.getByRole("row", { name: /^employment background check commercial/ })).toBeVisible();
  });
});
