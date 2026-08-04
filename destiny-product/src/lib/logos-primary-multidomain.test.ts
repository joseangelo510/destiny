import { describe, expect, it } from "vitest";
import { runDestinyServerLogic } from "./logicaffeine-server";

const base = { auditComplete: 1, criticalIssues: 0, warnings: 0, rankingKeywords: 0, newKeywords: 0, lostKeywords: 0, contentGaps: 0, reviewCount: 0 };

describe("LOGOS-primary multi-domain release fixtures", () => {
  it.each([
    ["college admissions services", { rankingKeywords: 42, newKeywords: 6, contentGaps: 18, reviewCount: 40, keywordPolicyEnabled: 1, keywordSearchVolume: 720, keywordIntentCode: 3, keywordIntentKnown: 1, keywordCoreMatches: 3, keywordSupportMatches: 5, keywordRevenueFitPercent: 92, keywordBusinessFitPercent: 95, keywordDifficulty: 48, keywordCpcCents: 860 }, "conversion"],
    ["commercial junk removal", { rankingKeywords: 18, newKeywords: 3, contentGaps: 12, reviewCount: 205, keywordPolicyEnabled: 1, keywordSearchVolume: 390, keywordIntentCode: 3, keywordIntentKnown: 1, keywordCoreMatches: 2, keywordSupportMatches: 4, keywordRevenueFitPercent: 94, keywordBusinessFitPercent: 96, keywordDifficulty: 31, keywordCpcCents: 1240 }, "conversion"],
    ["San Francisco home buyers", { rankingKeywords: 27, newKeywords: 4, contentGaps: 10, reviewCount: 32, keywordPolicyEnabled: 1, keywordSearchVolume: 260, keywordIntentCode: 2, keywordIntentKnown: 1, keywordCoreMatches: 2, keywordSupportMatches: 3, keywordRevenueFitPercent: 82, keywordBusinessFitPercent: 91, keywordDifficulty: 44, keywordCpcCents: 690 }, "consideration"],
  ] as const)("keeps %s recommendations relevant and demand-backed", async (_domain, facts, intent) => {
    const policy = await runDestinyServerLogic({ ...base, ...facts });
    expect(policy.keywordEligible).toBe(true);
    expect(policy.keywordVerdict).not.toBe("reject");
    expect(policy.keywordSearchIntent).toBe(intent);
    expect(policy.keywordPriorityScore).toBeGreaterThan(0);
    expect(policy.weeklyTaskManifest.length).toBe(policy.weeklyTaskCount);
  });

  it("rejects zero-demand noise instead of allowing it into a three-month plan", async () => {
    const policy = await runDestinyServerLogic({ ...base, keywordPolicyEnabled: 1, keywordSearchVolume: 0, keywordIntentKnown: 0, keywordCoreMatches: 0, keywordSupportMatches: 0, keywordRevenueFitPercent: 0, keywordBusinessFitPercent: 0 });
    expect(policy.keywordEligible).toBe(false);
    expect(policy.keywordVerdict).toBe("reject");
    expect(policy.keywordPriorityTier).toBe(0);
  });
});
