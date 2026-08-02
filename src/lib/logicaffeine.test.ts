import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { runDestinyLogic as runBrowserLogic } from "./logicaffeine";
import { runDestinyLogic as runWorkerLogic } from "../../supabase/functions/process-audit/logic";

const wasmPath = new URL("../../public/logic/destiny-logic-engine.wasm", import.meta.url);

async function runBoth(input: Parameters<typeof runBrowserLogic>[0]) {
  const bytes = await readFile(wasmPath);
  vi.stubGlobal("fetch", vi.fn(async () => new Response(bytes)));
  const [browser, worker] = await Promise.all([runBrowserLogic(input), runWorkerLogic(input)]);
  vi.unstubAllGlobals();
  return { browser, worker };
}

describe("Destiny LOGOS parity", () => {
  it.each([
    [{ auditComplete: 0, criticalIssues: 0, warnings: 0, rankingKeywords: 0, newKeywords: 0, lostKeywords: 0, contentGaps: 0, reviewCount: 0 }, { growthStage: "audit_in_progress", decisionCode: "audit_waiting", questCategory: "measurement", urgency: "waiting" }],
    [{ auditComplete: 1, criticalIssues: 3, warnings: 7, rankingKeywords: 40, newKeywords: 4, lostKeywords: 0, contentGaps: 0, reviewCount: 30 }, { growthStage: "fix_foundations", decisionCode: "fix_technical", questCategory: "technical", urgency: "urgent" }],
    [{ auditComplete: 1, criticalIssues: 0, warnings: 2, rankingKeywords: 40, newKeywords: 1, lostKeywords: 5, contentGaps: 0, reviewCount: 30 }, { growthStage: "build_search_coverage", decisionCode: "refresh_declining", questCategory: "content", urgency: "high" }],
    [{ auditComplete: 1, criticalIssues: 0, warnings: 0, rankingKeywords: 7, newKeywords: 2, lostKeywords: 0, contentGaps: 8, reviewCount: 20 }, { growthStage: "build_search_coverage", decisionCode: "publish_gap", questCategory: "content", urgency: "focused" }],
    [{ auditComplete: 1, criticalIssues: 0, warnings: 0, rankingKeywords: 22, newKeywords: 2, lostKeywords: 0, contentGaps: 0, reviewCount: 6 }, { growthStage: "compound_distribution", decisionCode: "request_reviews", questCategory: "reviews", urgency: "focused" }],
    [{ auditComplete: 1, criticalIssues: 0, warnings: 4, rankingKeywords: 22, newKeywords: 2, lostKeywords: 0, contentGaps: 0, reviewCount: 20 }, { growthStage: "compound_distribution", decisionCode: "fix_warning", questCategory: "technical", urgency: "routine" }],
    [{ auditComplete: 1, criticalIssues: 0, warnings: 0, rankingKeywords: 22, newKeywords: 2, lostKeywords: 0, contentGaps: 0, reviewCount: 20 }, { growthStage: "compound_distribution", decisionCode: "distribute_expertise", questCategory: "distribution", urgency: "routine" }],
  ] as const)("returns %s consistently", async (input, growthStage) => {
    const { browser, worker } = await runBoth(input);
    expect(browser).toEqual(worker);
    expect(browser).toMatchObject(growthStage);
    expect(browser.weeklyQuest.length).toBeGreaterThan(10);
    expect(browser.explanation.length).toBeGreaterThan(20);
  });

  it("uses a market-neutral content quest for non-local websites", async () => {
    const { browser, worker } = await runBoth({ auditComplete: 1, criticalIssues: 0, warnings: 0, rankingKeywords: 804516, newKeywords: 32, lostKeywords: 0, contentGaps: 24, reviewCount: 0 });
    expect(browser).toEqual(worker);
    expect(browser.weeklyQuest).toBe("Publish the highest-opportunity page");
  });

  it("accepts an essential competitor-backed keyword and returns moderate-plan quotas", async () => {
    const { browser, worker } = await runBoth({
      auditComplete: 1,
      criticalIssues: 0,
      warnings: 0,
      rankingKeywords: 20,
      newKeywords: 2,
      lostKeywords: 0,
      contentGaps: 4,
      reviewCount: 20,
      keywordCoreMatches: 1,
      keywordSupportMatches: 2,
      competitorRankers: 2,
      keywordBlocklisted: 0,
      planTier: 2,
    });
    expect(browser).toEqual(worker);
    expect(browser).toMatchObject({
      keywordVerdict: "accept",
      keywordRuleId: "essential_gap",
      essentialKeyword: true,
      weeklyTaskCount: 5,
      contentTaskCount: 2,
      distributionTaskCount: 1,
    });
  });

  it("routes borderline vocabulary matches to review and blocks explicit noise", async () => {
    const borderline = await runBoth({
      auditComplete: 1, criticalIssues: 0, warnings: 0, rankingKeywords: 10, newKeywords: 1, lostKeywords: 0, contentGaps: 1, reviewCount: 20,
      keywordCoreMatches: 0, keywordSupportMatches: 2, competitorRankers: 1, keywordBlocklisted: 0, planTier: 1,
    });
    expect(borderline.browser.keywordVerdict).toBe("review");
    const blocked = await runBoth({
      auditComplete: 1, criticalIssues: 0, warnings: 0, rankingKeywords: 10, newKeywords: 1, lostKeywords: 0, contentGaps: 1, reviewCount: 20,
      keywordCoreMatches: 3, keywordSupportMatches: 3, competitorRankers: 2, keywordBlocklisted: 1, planTier: 3,
    });
    expect(blocked.browser).toMatchObject({ keywordVerdict: "reject", keywordRuleId: "blocked_noise", weeklyTaskCount: 8 });
  });

  it("returns the exact Beginner, Moderate, and Super Growth task mix", async () => {
    const base = { auditComplete: 1, criticalIssues: 0, warnings: 0, rankingKeywords: 20, newKeywords: 2, lostKeywords: 0, contentGaps: 2, reviewCount: 20 };
    const beginner = await runBoth({ ...base, planTier: 1 });
    const moderate = await runBoth({ ...base, planTier: 2 });
    const superGrowth = await runBoth({ ...base, planTier: 3 });
    expect([beginner.browser.weeklyTaskCount, beginner.browser.contentTaskCount, beginner.browser.distributionTaskCount]).toEqual([3, 1, 0]);
    expect([moderate.browser.weeklyTaskCount, moderate.browser.contentTaskCount, moderate.browser.distributionTaskCount]).toEqual([5, 2, 1]);
    expect([superGrowth.browser.weeklyTaskCount, superGrowth.browser.contentTaskCount, superGrowth.browser.distributionTaskCount]).toEqual([8, 3, 2]);
    expect(beginner.browser.weeklyTaskManifest).toEqual(["vocabulary_review", "content_review", "primary_quest"]);
    expect(moderate.browser.weeklyTaskManifest).toEqual(["vocabulary_review", "content_review", "primary_quest", "reddit_distribution", "keyword_review"]);
    expect(superGrowth.browser.weeklyTaskManifest).toEqual(["vocabulary_review", "content_review", "primary_quest", "reddit_distribution", "keyword_review", "quora_distribution", "reviews", "llm_visibility"]);
  });
});
