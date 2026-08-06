import { describe, expect, it, vi } from "vitest";
import type { RankedKeywordOpportunity } from "./keyword-opportunity.ts";
import { applyLogosKeywordPolicy } from "./logos-keyword-policy.ts";
import { keywordPolicyEngine } from "./seo.ts";
import { JUNKIT_GOLDEN_KEYWORDS } from "./fixtures/98junkit-keywords.ts";

function opportunity(overrides: Partial<RankedKeywordOpportunity> = {}): RankedKeywordOpportunity {
  return {
    keyword: "college admissions consultant pricing",
    searchVolume: 590,
    difficulty: 42,
    cpc: 8.5,
    opportunity: "competitor_gap",
    competitorRankers: 3,
    directCompetitorRankers: 2,
    providerIntent: "transactional",
    searchIntent: "conversion",
    businessFit: 0.89,
    revenueFit: 1,
    relevanceTier: "core",
    priorityTier: 1,
    priorityScore: 93,
    priorityReason: "Buying intent",
    themeId: "admissions-services",
    themeLabel: "Admissions services",
    themeRole: "conversion",
    ...overrides,
  };
}

function referencePolicy(keyword: RankedKeywordOpportunity) {
  if (Number(keyword.searchVolume ?? 0) < 1) return null;
  const searchIntent = keyword.providerIntent === "transactional" ? "conversion" as const
    : keyword.providerIntent === "informational" ? "awareness" as const : "consideration" as const;
  const intentPoints = { transactional: 25, commercial: 21, navigational: 6, informational: 8 }[keyword.providerIntent];
  const volumePoints = Math.round(Math.min(10, 10 * Math.log10(Number(keyword.searchVolume) + 1) / 4.5));
  const difficulty = Math.min(100, Math.max(0, Number(keyword.difficulty ?? 0)));
  const attainabilityPoints = Math.round(5 * (1 - difficulty / 100));
  const valuePoints = Math.round(Math.min(5, 5 * Math.log10(Number(keyword.cpc ?? 0) + 1) / 1.7));
  const direct = Number(keyword.directCompetitorRankers ?? 0);
  const competitors = Number(keyword.competitorRankers ?? 0);
  const rank = Number(keyword.rank ?? 0);
  const opportunityPoints = keyword.opportunity === "existing_rank"
    ? rank >= 4 && rank <= 20 ? 5 : 4
    : keyword.opportunity === "competitor_gap"
      ? direct > 0 ? Math.min(5, 3 + direct) : Math.min(3, 1 + Math.round(competitors * .5))
      : 2;
  const priorityScore = Math.max(0, Math.min(100,
    intentPoints + Math.round(keyword.businessFit * 30) + Math.round(keyword.revenueFit * 20)
    + volumePoints + attainabilityPoints + valuePoints + opportunityPoints
    - (Number(keyword.searchVolume) < 20 && keyword.providerIntent !== "transactional" ? 3 : 0),
  ));
  const priorityTier = keyword.relevanceTier === "adjacent" ? 4 as const
    : keyword.revenueFit >= .85 ? 1 as const : keyword.revenueFit >= .45 ? 2 as const : 3 as const;
  const ruleId = keyword.relevanceTier === "core"
    ? competitors > 1 ? "essential_gap" as const : "site_vocabulary_match" as const
    : competitors > 0 ? "borderline_gap" as const : "supporting_evidence" as const;
  const reason = ruleId === "essential_gap"
    ? "The phrase matches the site's core vocabulary and at least two competitors rank for it"
    : ruleId === "site_vocabulary_match"
      ? "The phrase is directly supported by the site's core vocabulary"
      : ruleId === "borderline_gap"
        ? "The phrase has supporting site evidence and competitor demand but needs human review"
        : "The phrase has supporting business evidence and remains a secondary opportunity for review";
  const policyCode = `eligible_${keyword.relevanceTier}_${searchIntent}`;
  return {
    ...keyword,
    searchIntent,
    priorityTier,
    priorityScore,
    verdict: keyword.relevanceTier === "core" ? "accept" as const : "review" as const,
    ruleId,
    reason,
    essential: keyword.relevanceTier === "core" && keyword.revenueFit >= .65
      && (direct > 0 || keyword.providerIntent === "transactional"),
    policyCode,
    policyEngine: "logos" as const,
    dataQuality: "complete" as const,
    firedRuleIds: [ruleId],
  };
}

describe("LOGOS keyword policy authority", () => {
  it("defaults to LOGOS and preserves a one-variable TypeScript rollback", () => {
    const target = globalThis as typeof globalThis & { Deno?: { env: { get: (name: string) => string | undefined } } };
    const previous = target.Deno;
    delete target.Deno;
    expect(keywordPolicyEngine()).toBe("logos");
    target.Deno = { env: { get: (name) => name === "DESTINY_ENGINE" ? "typescript" : undefined } };
    expect(keywordPolicyEngine()).toBe("typescript");
    if (previous) target.Deno = previous;
    else delete target.Deno;
  });

  it("uses LOGOS outputs for eligibility, intent, tier, score, and rule metadata", async () => {
    const runLogic = vi.fn(async () => ({
      keywordEligible: true,
      keywordSearchIntent: "conversion" as const,
      keywordPriorityTier: 1 as const,
      keywordPriorityScore: 97,
      keywordVerdict: "accept" as const,
      keywordRuleId: "essential_gap" as const,
      keywordReason: "LOGOS accepted the measured conversion opportunity",
      keywordPolicyCode: "eligible_core_conversion",
      keywordRelevanceTier: "core" as const,
      keywordEssential: true,
      keywordDataQuality: "complete" as const,
      keywordRuleIds: ["eligible_core_conversion", "essential_gap"],
    }));

    const [ranked] = await applyLogosKeywordPolicy([opportunity({
      searchIntent: "awareness",
      priorityTier: 4,
      priorityScore: 1,
    })], runLogic);

    expect(runLogic).toHaveBeenCalledOnce();
    expect(ranked).toMatchObject({
      searchIntent: "conversion",
      priorityTier: 1,
      priorityScore: 97,
      verdict: "accept",
      ruleId: "essential_gap",
      reason: "LOGOS accepted the measured conversion opportunity",
      policyCode: "eligible_core_conversion",
      policyEngine: "logos",
      relevanceTier: "core",
      dataQuality: "complete",
      firedRuleIds: ["eligible_core_conversion", "essential_gap"],
      essential: true,
    });
  });

  it("removes a keyword when LOGOS rejects its eligibility", async () => {
    const runLogic = vi.fn(async () => ({
      keywordEligible: false,
      keywordSearchIntent: "consideration" as const,
      keywordPriorityTier: 0 as const,
      keywordPriorityScore: 0,
      keywordVerdict: "reject" as const,
      keywordRuleId: "no_vocabulary_match" as const,
      keywordReason: "LOGOS rejected the opportunity",
      keywordPolicyCode: "reject_no_relevance",
      keywordRelevanceTier: "none" as const,
      keywordEssential: false,
      keywordDataQuality: "intent_missing" as const,
      keywordRuleIds: ["reject_no_relevance"],
    }));

    await expect(applyLogosKeywordPolicy([opportunity()], runLogic)).resolves.toEqual([]);
  });

  it("sends normalized integer evidence to LOGOS", async () => {
    const runLogic = vi.fn(async () => ({
      keywordEligible: true,
      keywordSearchIntent: "consideration" as const,
      keywordPriorityTier: 2 as const,
      keywordPriorityScore: 80,
      keywordVerdict: "accept" as const,
      keywordRuleId: "site_vocabulary_match" as const,
      keywordReason: "Accepted",
      keywordPolicyCode: "eligible_core_consideration",
      keywordRelevanceTier: "core" as const,
      keywordEssential: false,
      keywordDataQuality: "complete" as const,
      keywordRuleIds: ["eligible_core_consideration"],
    }));

    await applyLogosKeywordPolicy([opportunity({
      providerIntent: "commercial",
      intent: "commercial",
      searchVolume: 1_900,
      difficulty: 37,
      cpc: 4.25,
      businessFit: 0.743,
      revenueFit: 0.851,
    })], runLogic);

    expect(runLogic).toHaveBeenCalledWith(expect.objectContaining({
      keywordPolicyEnabled: 1,
      keywordPositiveDemand: 1,
      keywordDisqualifiers: 0,
      keywordIntentCode: 2,
      keywordRelevanceCode: 2,
      keywordBusinessFitPercent: 74,
      keywordRevenueFitPercent: 85,
      keywordSearchVolume: 1_900,
      keywordDifficulty: 37,
      keywordCpcCents: 425,
      keywordOpportunityCode: 2,
      keywordIntentKnown: 1,
    }));
  });

  it("keeps LOGOS and the temporary TypeScript fallback numerically aligned", async () => {
    const candidate = opportunity({
      priorityScore: 89,
      searchVolume: 590,
      difficulty: 42,
      cpc: 8.5,
      businessFit: 0.89,
      revenueFit: 1,
    });
    const [ranked] = await applyLogosKeywordPolicy([candidate]);
    expect(ranked.priorityTier).toBe(candidate.priorityTier);
    expect(ranked.priorityScore).toBe(candidate.priorityScore);
  });

  it("contains a per-keyword WASM failure and preserves the TypeScript result", async () => {
    const candidate = opportunity();
    const runLogic = vi.fn(async () => { throw new Error("WASM panic"); });
    await expect(applyLogosKeywordPolicy([candidate], runLogic)).resolves.toEqual([
      expect.objectContaining({
        keyword: candidate.keyword,
        priorityScore: candidate.priorityScore,
        policyEngine: "typescript-fallback",
        policyCode: "fallback_wasm_error",
      }),
    ]);
  });

  it("bounds concurrent LOGOS evaluations so a large audit cannot exhaust the edge worker", async () => {
    let active = 0;
    let maximumActive = 0;
    const runLogic = vi.fn(async () => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 3));
      active -= 1;
      return {
        keywordEligible: true,
        keywordSearchIntent: "conversion" as const,
        keywordPriorityTier: 1 as const,
        keywordPriorityScore: 90,
        keywordVerdict: "accept" as const,
        keywordRuleId: "essential_gap" as const,
        keywordReason: "Accepted",
        keywordPolicyCode: "eligible_core_conversion",
        keywordRelevanceTier: "core" as const,
        keywordEssential: true,
        keywordDataQuality: "complete" as const,
        keywordRuleIds: ["essential_gap"],
      };
    });
    const candidates = Array.from({ length: 24 }, (_, index) => opportunity({ keyword: `keyword ${index}` }));

    await expect(applyLogosKeywordPolicy(candidates, runLogic)).resolves.toHaveLength(24);
    expect(maximumActive).toBeLessThanOrEqual(4);
    expect(runLogic).toHaveBeenCalledTimes(1);
  });

  it("uses LOGOS for the strongest candidate and the aligned fallback for the bulk edge workload", async () => {
    const runLogic = vi.fn(async () => ({
      keywordEligible: true,
      keywordSearchIntent: "conversion" as const,
      keywordPriorityTier: 1 as const,
      keywordPriorityScore: 90,
      keywordVerdict: "accept" as const,
      keywordRuleId: "essential_gap" as const,
      keywordReason: "Accepted",
      keywordPolicyCode: "eligible_core_conversion",
      keywordRelevanceTier: "core" as const,
      keywordEssential: true,
      keywordDataQuality: "complete" as const,
      keywordRuleIds: ["essential_gap"],
    }));
    const candidates = Array.from({ length: 90 }, (_, index) => opportunity({ keyword: `keyword ${index}` }));

    const result = await applyLogosKeywordPolicy(candidates, runLogic);

    expect(result).toHaveLength(90);
    expect(runLogic).toHaveBeenCalledTimes(1);
    expect(result.filter((keyword) => keyword.policyEngine === "logos")).toHaveLength(1);
    expect(result.filter((keyword) => keyword.policyCode === "fallback_edge_cpu_budget")).toHaveLength(89);
    expect(result.map((keyword) => keyword.keyword)).toContain("keyword 89");
  });

  it("matches the temporary TypeScript reference for 30 real 98 Junk It audit keywords", async () => {
    const actual = await applyLogosKeywordPolicy(JUNKIT_GOLDEN_KEYWORDS);
    const expected = JUNKIT_GOLDEN_KEYWORDS.map((candidate, index) => {
      const keyword = referencePolicy(candidate);
      if (!keyword || index === 0) return keyword;
      return {
        ...keyword,
        policyCode: "fallback_edge_cpu_budget",
        policyEngine: "typescript-fallback" as const,
        dataQuality: "fallback" as const,
        firedRuleIds: ["fallback_edge_cpu_budget", keyword.ruleId],
      };
    }).filter((keyword) => keyword !== null)
      .sort((left, right) => left.priorityTier - right.priorityTier
        || right.priorityScore - left.priorityScore
        || right.businessFit - left.businessFit
        || Number(right.searchVolume ?? 0) - Number(left.searchVolume ?? 0)
        || left.keyword.localeCompare(right.keyword));
    expect(actual).toEqual(expected);
    expect(actual).toHaveLength(24);
    expect(actual.filter((keyword) => keyword.policyEngine === "logos")).toHaveLength(1);
    expect(actual.slice(1).every((keyword) => keyword.policyEngine === "typescript-fallback")).toBe(true);
  });
});
