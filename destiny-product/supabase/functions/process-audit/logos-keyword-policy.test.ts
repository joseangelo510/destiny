import { describe, expect, it, vi } from "vitest";
import type { RankedKeywordOpportunity } from "./keyword-opportunity.ts";
import { applyLogosKeywordPolicy } from "./logos-keyword-policy.ts";
import { keywordPolicyEngine } from "./seo.ts";

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
    }));

    await applyLogosKeywordPolicy([opportunity({
      providerIntent: "commercial",
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
});
