import {
  runDestinyLogic,
  type DestinyLogicInput,
  type DestinyLogicResult,
} from "./logic.ts";
import type { RankedKeywordOpportunity } from "./keyword-opportunity.ts";

type KeywordPolicyResult = Pick<DestinyLogicResult,
  | "keywordEligible"
  | "keywordSearchIntent"
  | "keywordPriorityTier"
  | "keywordPriorityScore"
  | "keywordVerdict"
  | "keywordRuleId"
  | "keywordReason"
  | "keywordPolicyCode"
  | "keywordRelevanceTier"
  | "keywordEssential"
  | "keywordDataQuality"
  | "keywordRuleIds"
>;

type KeywordPolicyRunner = (input: DestinyLogicInput) => Promise<KeywordPolicyResult>;

const LOGOS_POLICY_CONCURRENCY = 4;
// The upstream ranker has already ordered these candidates. Destiny only saves
// 35 recommendations, so evaluating the strongest 60 preserves selection
// headroom without spending the Edge Function's CPU budget on 240 rows that
// cannot reach the product surface.
const LOGOS_POLICY_CANDIDATE_LIMIT = 60;

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(Math.max(1, concurrency), values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(values[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

export type LogosRankedKeywordOpportunity<T extends RankedKeywordOpportunity = RankedKeywordOpportunity> = T & {
  policyCode: string;
  policyEngine: "logos" | "typescript-fallback";
  verdict: DestinyLogicResult["keywordVerdict"];
  ruleId: DestinyLogicResult["keywordRuleId"];
  reason: string;
  essential: boolean;
  dataQuality: DestinyLogicResult["keywordDataQuality"] | "fallback";
  firedRuleIds: string[];
};

function intentCode(intent: RankedKeywordOpportunity["providerIntent"]): 0 | 1 | 2 | 3 {
  if (intent === "transactional") return 3;
  if (intent === "commercial") return 2;
  if (intent === "navigational") return 1;
  return 0;
}

function opportunityCode(opportunity: RankedKeywordOpportunity["opportunity"]): 0 | 1 | 2 {
  if (opportunity === "existing_rank") return 1;
  if (opportunity === "competitor_gap") return 2;
  return 0;
}

function policyInput(keyword: RankedKeywordOpportunity): DestinyLogicInput {
  const searchVolume = Math.max(0, Number(keyword.searchVolume ?? 0));
  return {
    auditComplete: 1,
    criticalIssues: 0,
    warnings: 0,
    rankingKeywords: 0,
    newKeywords: 0,
    lostKeywords: 0,
    contentGaps: 0,
    reviewCount: 0,
    keywordCoreMatches: keyword.relevanceTier === "core" ? 1 : 0,
    keywordSupportMatches: keyword.relevanceTier === "adjacent" ? 1 : 0,
    competitorRankers: Math.max(0, Math.round(Number(keyword.competitorRankers ?? 0))),
    keywordBlocklisted: 0,
    keywordPolicyEnabled: 1,
    keywordPositiveDemand: searchVolume > 0 ? 1 : 0,
    keywordDisqualifiers: 0,
    keywordIntentCode: intentCode(keyword.providerIntent),
    keywordRelevanceCode: keyword.relevanceTier === "core" ? 2 : 1,
    keywordBusinessFitPercent: Math.round(keyword.businessFit * 100),
    keywordRevenueFitPercent: Math.round(keyword.revenueFit * 100),
    keywordSearchVolume: Math.round(searchVolume),
    keywordDifficulty: Math.round(Number(keyword.difficulty ?? 0)),
    keywordCpcCents: Math.round(Math.max(0, Number(keyword.cpc ?? 0)) * 100),
    keywordRank: Math.round(Math.max(0, Number(keyword.rank ?? 0))),
    keywordOpportunityCode: opportunityCode(keyword.opportunity),
    keywordDirectCompetitorRankers: Math.max(0, Math.round(Number(keyword.directCompetitorRankers ?? 0))),
    keywordIntentKnown: typeof keyword.intent === "string" && keyword.intent.trim() ? 1 : 0,
  };
}

export async function applyLogosKeywordPolicy<T extends RankedKeywordOpportunity>(
  keywords: T[],
  runLogic: KeywordPolicyRunner = runDestinyLogic,
): Promise<Array<LogosRankedKeywordOpportunity<T>>> {
  const policyCandidates = keywords.slice(0, LOGOS_POLICY_CANDIDATE_LIMIT);
  const evaluated = await mapWithConcurrency(policyCandidates, LOGOS_POLICY_CONCURRENCY, async (keyword) => {
    let result: KeywordPolicyResult;
    try {
      result = await runLogic(policyInput(keyword));
    } catch {
      return {
        ...keyword,
        verdict: keyword.relevanceTier === "core" ? "accept" as const : "review" as const,
        ruleId: keyword.relevanceTier === "core" ? "site_vocabulary_match" as const : "borderline_gap" as const,
        reason: keyword.priorityReason,
        essential: keyword.priorityTier === 1,
        policyCode: "fallback_wasm_error",
        policyEngine: "typescript-fallback" as const,
        dataQuality: "fallback" as const,
        firedRuleIds: ["fallback_wasm_error"],
      };
    }
    if (!result.keywordEligible) return null;
    return {
      ...keyword,
      searchIntent: result.keywordSearchIntent,
      relevanceTier: result.keywordRelevanceTier as "core" | "adjacent",
      priorityTier: result.keywordPriorityTier as 1 | 2 | 3 | 4,
      priorityScore: result.keywordPriorityScore,
      verdict: result.keywordVerdict,
      ruleId: result.keywordRuleId,
      reason: result.keywordReason,
      essential: result.keywordEssential,
      policyCode: result.keywordPolicyCode,
      policyEngine: "logos" as const,
      dataQuality: result.keywordDataQuality,
      firedRuleIds: result.keywordRuleIds,
    };
  });

  return evaluated.filter((keyword): keyword is LogosRankedKeywordOpportunity<T> => keyword !== null)
    .sort((left, right) => left.priorityTier - right.priorityTier
      || right.priorityScore - left.priorityScore
      || right.businessFit - left.businessFit
      || Number(right.searchVolume ?? 0) - Number(left.searchVolume ?? 0)
      || left.keyword.localeCompare(right.keyword));
}
