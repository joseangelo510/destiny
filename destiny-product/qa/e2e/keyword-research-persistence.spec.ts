import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

type BrowserFixture = {
  mvp: {
    websiteId: string;
  };
};

const fixturePath = process.env.QA_LOCAL_BROWSER_FIXTURE;
const fixture = fixturePath
  ? JSON.parse(readFileSync(fixturePath, "utf8")) as BrowserFixture
  : null;
if (!fixture) throw new Error("Run pnpm qa:browser-fixture against disposable local Supabase before keyword research certification.");

const query = "small business seo consultant";
const checkedAt = "2026-08-27T18:00:00.000Z";

const researchResult = {
  sourceLabel: "Deterministic provider fixture",
  query,
  mode: "keyword",
  location: "United States",
  updatedAt: checkedAt,
  metrics: {
    totalKeywords: 3,
    totalVolume: 1_160,
    averageDifficulty: 31,
    estimatedTraffic: 0,
  },
  questions: [],
  related: [],
  serpCheckedAt: checkedAt,
  serpEvidenceStatus: "live",
  rows: [
    { keyword: query, intent: "commercial", volume: 600, difficulty: 31, cpc: 7.2, competition: 0.42, trend: [90, 100, 95], position: 0, traffic: 0, url: "" },
    { keyword: "seo consultant pricing", intent: "transactional", volume: 390, difficulty: 29, cpc: 8.1, competition: 0.51, trend: [80, 85, 100], position: 0, traffic: 0, url: "" },
    { keyword: "seo consultant checklist", intent: "informational", volume: 170, difficulty: 33, cpc: 3.4, competition: 0.28, trend: [100, 92, 96], position: 0, traffic: 0, url: "" },
  ],
  notices: ["Provider research is intercepted only for this persistence certification."],
};

test.describe("@gate keyword research persistence", () => {
  test("researches first-page evidence and preserves two saved ideas in their list after revisit", async ({ page }, testInfo) => {
    const mobile = testInfo.project.name === "mobile";
    const question = mobile
      ? "What should a growing business look for in an SEO consultant?"
      : "How do small businesses choose an SEO consultant?";
    const related = mobile
      ? "best seo consultant for growing small business"
      : "affordable seo consultant for small business";
    const listName = mobile ? "Growth questions" : "Launch questions";

    await page.route("**/api/research/keywords", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ ...researchResult, questions: [question], related: [related] }),
        status: 200,
      });
    });
    await page.route("**/api/research/keyword-serp", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          keyword: query,
          location: "United States",
          checkedAt,
          organic: [
            { position: 1, domain: "example.com", title: "SEO Consulting for Small Business", url: "https://example.com/services/seo-consulting", pageType: "service_page" },
            { position: 2, domain: "example.org", title: "How to Choose an SEO Consultant", url: "https://example.org/blog/choose-an-seo-consultant", pageType: "blog_post" },
          ],
          questions: [question],
          related: [related],
        }),
        status: 200,
      });
    });

    const runResearch = async () => {
      const searchPanel = page.locator(".research-search-panel");
      await searchPanel.getByRole("button", { name: "Keyword", exact: true }).click();
      await searchPanel.getByLabel("Keyword phrase").fill(query);
      await searchPanel.getByRole("button", { name: "Search", exact: true }).click();
      await expect(page.getByRole("heading", { name: query })).toBeVisible();
    };

    await page.goto(`/keyword-research?site=${fixture!.mvp.websiteId}`);
    await runResearch();

    await page.getByRole("row", { name: new RegExp(`^${query}`) }).getByRole("button", { name: "View first page" }).click();
    const drawer = page.getByLabel(`First-page results for ${query}`);
    await expect(drawer.getByText("Who ranks on page one", { exact: true })).toBeVisible();
    await expect(drawer.getByText("Service page", { exact: true })).toBeVisible();
    await expect(drawer.getByText("Blog post", { exact: true })).toBeVisible();
    await drawer.getByRole("button", { name: "Close first-page results" }).click();

    const questionsCard = page.locator(".keyword-insight-card").filter({ hasText: "Questions people ask" });
    await questionsCard.getByRole("listitem").filter({ hasText: question }).getByRole("button", { name: "Save", exact: true }).click();
    const savePanel = page.getByLabel("Save keywords to a list");
    await savePanel.getByLabel("New keyword list name").fill(listName);
    await savePanel.getByRole("button", { name: "Create list", exact: true }).click();
    await expect(savePanel.getByLabel("Keyword list", { exact: true })).not.toHaveValue("");
    await savePanel.getByRole("button", { name: "Save keywords", exact: true }).click();
    await expect(questionsCard.getByRole("button", { name: `Saved to ${listName} ✓`, exact: true })).toBeDisabled();

    const relatedCard = page.locator(".keyword-insight-card").filter({ hasText: "Other keyword opportunities" });
    await relatedCard.getByRole("listitem").filter({ hasText: related }).getByRole("button", { name: "Save", exact: true }).click();
    await savePanel.getByLabel("Keyword list", { exact: true }).selectOption({ label: listName });
    await savePanel.getByRole("button", { name: "Save keywords", exact: true }).click();
    await expect(relatedCard.getByRole("button", { name: `Saved to ${listName} ✓`, exact: true })).toBeDisabled();

    await page.goto(`/this-week?site=${fixture!.mvp.websiteId}`);
    await page.goto(`/keyword-research?site=${fixture!.mvp.websiteId}`);
    await runResearch();

    await expect(page.locator(".keyword-insight-card").filter({ hasText: "Questions people ask" }).getByRole("button", { name: `Saved to ${listName} ✓`, exact: true })).toBeDisabled();
    await expect(page.locator(".keyword-insight-card").filter({ hasText: "Other keyword opportunities" }).getByRole("button", { name: `Saved to ${listName} ✓`, exact: true })).toBeDisabled();

    await page.getByRole("row", { name: /seo consultant pricing/ }).getByRole("button", { name: "Save", exact: true }).click();
    await expect(savePanel.getByLabel("Keyword list", { exact: true }).getByRole("option", { name: listName, exact: true })).toHaveCount(1);
  });
});
