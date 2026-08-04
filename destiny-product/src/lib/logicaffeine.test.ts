import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { runDestinyLogic as runBrowserLogic } from "./logicaffeine";
import { runDestinyLogic as runWorkerLogic } from "../../supabase/functions/process-audit/logic";
import { JUNKIT_RECOMMENDATION_FIXTURE } from "../../supabase/functions/process-audit/fixtures/98junkit-recommendation";

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
      distributionTaskCount: 2,
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

  it("makes LOGOS authoritative for keyword eligibility, intent, tier, and score", async () => {
    const conversion = await runBoth({
      auditComplete: 1,
      criticalIssues: 0,
      warnings: 0,
      rankingKeywords: 20,
      newKeywords: 2,
      lostKeywords: 0,
      contentGaps: 4,
      reviewCount: 20,
      keywordCoreMatches: 2,
      keywordSupportMatches: 2,
      competitorRankers: 2,
      keywordBlocklisted: 0,
      keywordPolicyEnabled: 1,
      keywordPositiveDemand: 1,
      keywordDisqualifiers: 0,
      keywordIntentCode: 3,
      keywordRelevanceCode: 2,
      keywordBusinessFitPercent: 89,
      keywordRevenueFitPercent: 100,
      keywordVolumePoints: 7,
      keywordAttainabilityPoints: 4,
      keywordValuePoints: 5,
      keywordOpportunityPoints: 5,
      keywordDemandPenalty: 0,
      keywordSearchVolume: 590,
      keywordDifficulty: 20,
      keywordCpcCents: 4_000,
      keywordRank: 0,
      keywordOpportunityCode: 2,
      keywordDirectCompetitorRankers: 2,
      keywordIntentKnown: 1,
      planTier: 2,
    } as Parameters<typeof runBrowserLogic>[0]);

    expect(conversion.browser).toEqual(conversion.worker);
    expect(conversion.browser).toMatchObject({
      keywordEligible: true,
      keywordSearchIntent: "conversion",
      keywordPriorityTier: 1,
      keywordPriorityScore: 92,
      keywordPolicyCode: "eligible_core_conversion",
      keywordRelevanceTier: "core",
      keywordEssential: true,
      keywordDataQuality: "complete",
    });

    const zeroDemand = await runBoth({
      auditComplete: 1,
      criticalIssues: 0,
      warnings: 0,
      rankingKeywords: 20,
      newKeywords: 2,
      lostKeywords: 0,
      contentGaps: 4,
      reviewCount: 20,
      keywordCoreMatches: 2,
      keywordSupportMatches: 2,
      competitorRankers: 2,
      keywordBlocklisted: 0,
      keywordPolicyEnabled: 1,
      keywordPositiveDemand: 0,
      keywordDisqualifiers: 0,
      keywordIntentCode: 3,
      keywordRelevanceCode: 2,
      keywordBusinessFitPercent: 89,
      keywordRevenueFitPercent: 100,
      keywordVolumePoints: 0,
      keywordAttainabilityPoints: 4,
      keywordValuePoints: 5,
      keywordOpportunityPoints: 5,
      keywordDemandPenalty: 0,
      keywordSearchVolume: 0,
      keywordDifficulty: 20,
      keywordCpcCents: 4_000,
      keywordRank: 0,
      keywordOpportunityCode: 2,
      keywordDirectCompetitorRankers: 2,
      keywordIntentKnown: 1,
      planTier: 2,
    } as Parameters<typeof runBrowserLogic>[0]);

    expect(zeroDemand.browser).toMatchObject({
      keywordEligible: false,
      keywordVerdict: "reject",
      keywordPolicyCode: "reject_no_demand",
      keywordPriorityScore: 0,
      keywordRelevanceTier: "core",
      keywordEssential: false,
    });
  });

  it("returns the exact categorized execution mix without a second business confirmation", async () => {
    const base = { auditComplete: 1, criticalIssues: 0, warnings: 0, rankingKeywords: 20, newKeywords: 2, lostKeywords: 0, contentGaps: 2, reviewCount: 20 };
    const beginner = await runBoth({ ...base, planTier: 1 });
    const moderate = await runBoth({ ...base, planTier: 2 });
    const superGrowth = await runBoth({ ...base, planTier: 3 });
    expect([beginner.browser.weeklyTaskCount, beginner.browser.contentTaskCount, beginner.browser.distributionTaskCount]).toEqual([3, 1, 0]);
    expect([moderate.browser.weeklyTaskCount, moderate.browser.contentTaskCount, moderate.browser.distributionTaskCount]).toEqual([5, 2, 2]);
    expect([superGrowth.browser.weeklyTaskCount, superGrowth.browser.contentTaskCount, superGrowth.browser.distributionTaskCount]).toEqual([8, 3, 4]);
    expect(beginner.browser.weeklyTaskManifest).toEqual(["keyword_review", "primary_quest", "content_review"]);
    expect(moderate.browser.weeklyTaskManifest).toEqual(["keyword_review", "primary_quest", "content_review", "community_distribution", "social_distribution"]);
    expect(superGrowth.browser.weeklyTaskManifest).toEqual(["keyword_review", "primary_quest", "content_review", "community_distribution", "social_distribution", "publisher_outreach", "directory_growth", "technical_review"]);
  });

  it.each([
    ["zero demand beats strong relevance", { keywordSearchVolume: 0 }, { keywordEligible: false, keywordPolicyCode: "reject_no_demand", keywordPriorityScore: 0 }],
    ["blocklist beats high fit", { keywordBlocklisted: 1 }, { keywordEligible: false, keywordPolicyCode: "reject_blocklisted", keywordPriorityScore: 0, keywordRuleIds: ["reject_blocklisted", "blocked_noise"] }],
    ["explicit disqualifier rejects", { keywordDisqualifiers: 1 }, { keywordEligible: false, keywordPolicyCode: "reject_disqualified" }],
    ["missing relevance rejects", { keywordCoreMatches: 0, keywordSupportMatches: 0 }, { keywordEligible: false, keywordRelevanceTier: "none", keywordPolicyCode: "reject_no_relevance" }],
    ["supporting evidence stays reviewable", { keywordCoreMatches: 0, keywordSupportMatches: 1 }, { keywordEligible: true, keywordRelevanceTier: "adjacent", keywordVerdict: "review", keywordPriorityTier: 4 }],
    ["revenue fit 84 stays tier two", { keywordRevenueFitPercent: 84 }, { keywordPriorityTier: 2 }],
    ["revenue fit 85 enters tier one", { keywordRevenueFitPercent: 85 }, { keywordPriorityTier: 1 }],
    ["missing provider intent is explicit", { keywordIntentKnown: 0 }, { keywordDataQuality: "intent_missing" }],
    ["known provider intent is complete", { keywordIntentKnown: 1 }, { keywordDataQuality: "complete" }],
    ["extreme volume remains bounded", { keywordSearchVolume: 1_000_000_000 }, { keywordEligible: true }],
    ["invalid high difficulty is clamped", { keywordDifficulty: 999 }, { keywordEligible: true }],
    ["minimum essential signals qualify", { keywordRevenueFitPercent: 65, keywordDirectCompetitorRankers: 1 }, { keywordEssential: true }],
    ["sub-threshold revenue is not essential", { keywordRevenueFitPercent: 64, keywordDirectCompetitorRankers: 1 }, { keywordEssential: false }],
    ["transactional core demand can be essential without a direct competitor", { keywordDirectCompetitorRankers: 0, keywordIntentCode: 3 }, { keywordEssential: true }],
    ["low-volume awareness remains eligible with its penalty", { keywordSearchVolume: 10, keywordIntentCode: 0 }, { keywordEligible: true, keywordSearchIntent: "awareness" }],
  ] as const)("enforces raw keyword policy: %s", async (_label, overrides, expected) => {
    const input = {
      auditComplete: 1,
      criticalIssues: 0,
      warnings: 0,
      rankingKeywords: 20,
      newKeywords: 2,
      lostKeywords: 0,
      contentGaps: 4,
      reviewCount: 20,
      keywordCoreMatches: 1,
      keywordSupportMatches: 0,
      competitorRankers: 2,
      keywordBlocklisted: 0,
      keywordPolicyEnabled: 1,
      keywordDisqualifiers: 0,
      keywordIntentCode: 3,
      keywordBusinessFitPercent: 89,
      keywordRevenueFitPercent: 100,
      keywordSearchVolume: 590,
      keywordDifficulty: 42,
      keywordCpcCents: 850,
      keywordRank: 0,
      keywordOpportunityCode: 2 as const,
      keywordDirectCompetitorRankers: 2,
      keywordIntentKnown: 1,
      planTier: 2 as const,
      ...overrides,
    };
    const { browser, worker } = await runBoth(input);
    expect(browser).toEqual(worker);
    expect(browser).toMatchObject(expected);
    expect(browser.keywordPriorityScore).toBeGreaterThanOrEqual(0);
    expect(browser.keywordPriorityScore).toBeLessThanOrEqual(100);
  });

  it("lets LOGOS deterministically choose a critical issue over a warning", async () => {
    const input = {
      auditComplete: 1, criticalIssues: 1, warnings: 1, rankingKeywords: 20, newKeywords: 2, lostKeywords: 0, contentGaps: 2, reviewCount: 20,
      criticalHighLoading: 1, warningNoTitle: 1, planTier: 3 as const,
    };
    const first = await runBoth(input);
    const second = await runBoth(input);
    expect(first.browser).toEqual(first.worker);
    expect(first.browser).toEqual(second.browser);
    expect(first.browser).toMatchObject({
      weeklyQuest: "Reduce the time visitors wait for your homepage",
      questSource: "issue_fix",
      issueQuestCode: "high_loading_time",
      issueDataQuality: "complete",
      urgency: "urgent",
    });
  });

  it("keeps the growth recommendation when no recognized issue exists", async () => {
    const { browser, worker } = await runBoth({
      auditComplete: 1, criticalIssues: 0, warnings: 0, rankingKeywords: 20, newKeywords: 2, lostKeywords: 0, contentGaps: 2, reviewCount: 20,
      planTier: 1,
    });
    expect(browser).toEqual(worker);
    expect(browser).toMatchObject({
      weeklyQuest: "Publish the highest-opportunity page",
      questSource: "growth_action",
      issueQuestCode: "none",
      issueDataQuality: "complete",
    });
  });

  it("flags an unknown provider issue without panicking or inventing a fix", async () => {
    const { browser, worker } = await runBoth({
      auditComplete: 1, criticalIssues: 0, warnings: 1, rankingKeywords: 20, newKeywords: 2, lostKeywords: 0, contentGaps: 0, reviewCount: 20,
      unknownIssueCount: 1, planTier: 1,
    });
    expect(browser).toEqual(worker);
    expect(browser).toMatchObject({
      questSource: "growth_action",
      issueQuestCode: "none",
      issueDataQuality: "unknown_issue",
    });
  });

  it.each([
    [1, ["keyword_review", "primary_quest", "content_review"], [true, false, true], [1, 1, 1], [1, 1, 1]],
    [2, ["keyword_review", "primary_quest", "content_review", "community_distribution", "social_distribution"], [true, false, true, false, false], [1, 1, 1, 2, 2], [1, 1, 1, 2, 2]],
    [3, ["keyword_review", "primary_quest", "content_review", "community_distribution", "social_distribution", "publisher_outreach", "directory_growth", "technical_review"], [true, false, true, false, false, true, false, false], [1, 1, 1, 2, 2, 3, 3, 3], [1, 1, 1, 2, 2, 3, 3, 3]],
  ] as const)("returns complete LOGOS-owned task decisions for tier %s", async (planTier, manifest, approvals, tiers, priorities) => {
    const { browser, worker } = await runBoth({
      auditComplete: 1, criticalIssues: 0, warnings: 0, rankingKeywords: 20, newKeywords: 2, lostKeywords: 0, contentGaps: 2, reviewCount: 20,
      planTier,
    });
    expect(browser).toEqual(worker);
    expect(browser.weeklyTaskManifest).toEqual(manifest);
    expect(browser.weeklyTaskApprovals).toEqual(approvals);
    expect(browser.weeklyTaskTiers).toEqual(tiers);
    expect(browser.weeklyTaskPriorities).toEqual(priorities);
    expect(browser.weeklyTaskCount).toBe(manifest.length);
  });

  it("matches the real 98junkit audit recommendation fixture across both WASM adapters", async () => {
    const { browser, worker } = await runBoth(JUNKIT_RECOMMENDATION_FIXTURE.input);
    expect(browser).toEqual(worker);
    expect(browser).toMatchObject(JUNKIT_RECOMMENDATION_FIXTURE.expected);
    expect(browser.weeklyTaskManifest).toHaveLength(browser.weeklyTaskCount);
    expect(browser.weeklyTaskApprovals).toHaveLength(browser.weeklyTaskCount);
    expect(browser.weeklyTaskTiers).toHaveLength(browser.weeklyTaskCount);
    expect(browser.weeklyTaskPriorities).toHaveLength(browser.weeklyTaskCount);
  });

  it("still emits a coherent recommendation when zero keywords survive eligibility", async () => {
    const { browser, worker } = await runBoth({
      auditComplete: 1, criticalIssues: 0, warnings: 0, rankingKeywords: 0, newKeywords: 0, lostKeywords: 0, contentGaps: 0, reviewCount: 0,
      keywordPolicyEnabled: 1, keywordSearchVolume: 0, keywordCoreMatches: 0, keywordSupportMatches: 0, competitorRankers: 0,
      planTier: 1,
    });
    expect(browser).toEqual(worker);
    expect(browser.keywordEligible).toBe(false);
    expect(browser.questSource).toBe("growth_action");
    expect(browser.weeklyQuest).toBe("Ask three recent customers for a Google review");
    expect(browser.weeklyTaskManifest).toEqual(["keyword_review", "primary_quest", "content_review"]);
    expect(browser.weeklyTaskManifest).toHaveLength(browser.weeklyTaskCount);
  });

  it("keeps equal-priority manifest tasks in deterministic LOGOS order", async () => {
    const input = {
      auditComplete: 1, criticalIssues: 0, warnings: 0, rankingKeywords: 20, newKeywords: 2, lostKeywords: 0, contentGaps: 2, reviewCount: 20,
      planTier: 3 as const,
    };
    const first = await runBoth(input);
    const second = await runBoth(input);
    const firstPriorityTasks = first.browser.weeklyTaskManifest.filter((_task, index) => first.browser.weeklyTaskPriorities[index] === 1);
    const secondPriorityTasks = second.browser.weeklyTaskManifest.filter((_task, index) => second.browser.weeklyTaskPriorities[index] === 1);
    expect(firstPriorityTasks).toEqual(["keyword_review", "primary_quest", "content_review"]);
    expect(secondPriorityTasks).toEqual(firstPriorityTasks);
    expect(first.browser).toEqual(first.worker);
    expect(second.browser).toEqual(second.worker);
  });

  it.each([
    ["business confirmation auto-verifies", { questTaskCode: 1, questCurrentStatusCode: 0, questRequestedStatusCode: 1, questRemainingAfterCompletion: -1 }, { questTransitionAllowed: true, questTransitionRuleId: "allow_complete", questVerificationStatus: "verified", questSetCompletedAt: true, questSetVerifiedAt: true, questClearEvidence: false, questCelebration: "verified_result" }],
    ["ordinary work stays self-reported", { questTaskCode: 6, questCurrentStatusCode: 0, questRequestedStatusCode: 1, questRemainingAfterCompletion: 2 }, { questTransitionAllowed: true, questVerificationStatus: "unverified", questCelebration: "task_complete" }],
    ["reopening clears evidence", { questTaskCode: 2, questCurrentStatusCode: 1, questRequestedStatusCode: 0, questRemainingAfterCompletion: 2 }, { questTransitionAllowed: true, questTransitionRuleId: "allow_reopen", questSetCompletedAt: false, questSetVerifiedAt: false, questClearEvidence: true, questCelebration: "none" }],
    ["last actionable task earns Perfect Week", { questTaskCode: 6, questCurrentStatusCode: 0, questRequestedStatusCode: 1, questRemainingAfterCompletion: 0 }, { questTransitionAllowed: true, questCelebration: "perfect_week" }],
    ["primary task unlocks roadmap", { questTaskCode: 2, questCurrentStatusCode: 0, questRequestedStatusCode: 1, questRemainingAfterCompletion: 1 }, { questTransitionAllowed: true, questCelebration: "roadmap_unlock" }],
    ["content task unlocks roadmap", { questTaskCode: 4, questCurrentStatusCode: 0, questRequestedStatusCode: 1, questRemainingAfterCompletion: 1 }, { questTransitionAllowed: true, questCelebration: "roadmap_unlock" }],
    ["required primary task cannot be skipped", { questTaskCode: 2, questCurrentStatusCode: 0, questRequestedStatusCode: 2, questRemainingAfterCompletion: 2 }, { questTransitionAllowed: false, questTransitionRuleId: "reject_required_task_skip", questCelebration: "none" }],
    ["required keyword task cannot be skipped", { questTaskCode: 3, questCurrentStatusCode: 0, questRequestedStatusCode: 2, questRemainingAfterCompletion: 2 }, { questTransitionAllowed: false, questTransitionRuleId: "reject_required_task_skip" }],
    ["optional task can be skipped", { questTaskCode: 6, questCurrentStatusCode: 0, questRequestedStatusCode: 2, questRemainingAfterCompletion: 2 }, { questTransitionAllowed: true, questTransitionRuleId: "allow_skip", questClearEvidence: true }],
    ["unknown status is rejected", { questTaskCode: 6, questCurrentStatusCode: 9, questRequestedStatusCode: 1, questRemainingAfterCompletion: 2 }, { questTransitionAllowed: false, questTransitionRuleId: "reject_unknown_current_status" }],
  ] as const)("owns quest transition: %s", async (_label, transition, expected) => {
    const { browser, worker } = await runBoth({
      auditComplete: 0, criticalIssues: 0, warnings: 0, rankingKeywords: 0, newKeywords: 0, lostKeywords: 0, contentGaps: 0, reviewCount: 0,
      ...transition,
    });
    expect(browser).toEqual(worker);
    expect(browser).toMatchObject(expected);
  });

  it("owns the remaining onboarding, audit, rank, and article policy gates in both adapters", async () => {
    const { browser, worker } = await runBoth({
      auditComplete: 0, criticalIssues: 0, warnings: 0, rankingKeywords: 0, newKeywords: 0, lostKeywords: 0, contentGaps: 0, reviewCount: 0,
      onboardingOneFields: 5, onboardingEmailValid: 1, onboardingUrlValid: 1, onboardingTwoFields: 4,
      auditHealthAvailable: 1, auditHealthRaw: 74, auditMeasuredCritical: 2, auditMeasuredWarnings: 4, auditVisibleIssues: 5,
      rankStatusCode: 1, rankFoundCode: 1, rankCurrentPosition: 7, rankHasPrevious: 1, rankPreviousFound: 1, rankPreviousPosition: 13,
      rankHasLastCheck: 1, rankAgeDays: 7,
      articleFormatCode: 1, articleWordCount: 2400, articleH1Count: 1, articleH2Count: 7, articleH3Count: 2,
      articleTitleKeyword: 1, articleFirstH2Keyword: 1, articleKeywordFreePercent: 45, articleBrigadeCount: 6,
      articleFirstBrigade: 120, articleMinBrigadeGap: 140, articleMetaCount: 2, articleSourceCount: 4, articleCitedCount: 4,
    });
    expect(browser).toEqual(worker);
    expect(browser).toMatchObject({
      onboardingOneReady: true, onboardingTwoReady: true,
      auditHealthScore: 74, auditHealthCode: 2, auditIsPartial: true,
      rankReadingCode: 3, rankMovementCode: 4, rankMovementDelta: 6, rankFreshnessCode: 2, rankBucket: 2,
      articleWordIssue: false, articleHeadingIssue: false, articleHeadingKeywordIssue: false, articleHeadingVarietyIssue: false,
      articleBrigadeIssue: false, articleBrigadeSpacingIssue: false, articleStockIssue: false, articleMetaIssue: false, articleSourceIssue: false,
    });
  });
});
