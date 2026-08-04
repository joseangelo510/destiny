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
>;

type KeywordPolicyRunner = (input: DestinyLogicInput) => Promise<KeywordPolicyResult>;

export type LogosRankedKeywordOpportunity<T extends RankedKeywordOpportunity = RankedKeywordOpportunity> = T & {
  policyCode: string;
  policyEngine: "logos";
  verdict: DestinyLogicResult["keywordVerdict"];
  ruleId: DestinyLogicResult["keywordRuleId"];
  reason: string;
  essential: boolean;
};

function intentCode(intent: RankedKeywordOpportunity["providerIntent"]): 0 | 1 | 2 | 3 {
  if (intent === "transactional") return 3;
  if (intent === "commercial") return 2;
  if (intent === "navigational") return 1;
  return 0;
}

function volumePoints(searchVolume: number) {
  return Math.round(Math.min(10, 10 * Math.log10(Math.max(0, searchVolume) + 1) / 4.5));
}

function attainabilityPoints(difficulty: number) {
  return Math.round(Math.max(0, 5 * (1 - Math.min(100, Math.max(0, difficulty)) / 100)));
}

function valuePoints(cpc: number) {
  return Math.round(Math.min(5, 5 * Math.log10(Math.max(0, cpc) + 1) / 1.7));
}

function opportunityPoints(keyword: RankedKeywordOpportunity) {
  const rank = Math.max(0, Number(keyword.rank ?? 0));
  const competitors = Math.max(0, Number(keyword.competitorRankers ?? 0));
  const directCompetitors = Math.max(0, Number(keyword.directCompetitorRankers ?? 0));
  if (keyword.opportunity === "existing_rank" && rank >= 4 && rank <= 20) return 5;
  if (keyword.opportunity === "competitor_gap" && directCompetitors > 0) return Math.min(5, 3 + directCompetitors);
  if (keyword.opportunity === "competitor_gap") return Math.round(Math.min(3, 1 + competitors * 0.5));
  if (keyword.opportunity === "existing_rank") return 4;
  return 2;
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
    keywordSupportMatches: keyword.relevanceTier === "adjacent" ? 2 : 0,
    competitorRankers: Math.max(0, Math.round(Number(keyword.competitorRankers ?? 0))),
    keywordBlocklisted: 0,
    keywordPolicyEnabled: 1,
    keywordPositiveDemand: searchVolume > 0 ? 1 : 0,
    keywordDisqualifiers: 0,
    keywordIntentCode: intentCode(keyword.providerIntent),
    keywordRelevanceCode: keyword.relevanceTier === "core" ? 2 : 1,
    keywordBusinessFitPercent: Math.round(keyword.businessFit * 100),
    keywordRevenueFitPercent: Math.round(keyword.revenueFit * 100),
    keywordVolumePoints: volumePoints(searchVolume),
    keywordAttainabilityPoints: attainabilityPoints(Number(keyword.difficulty ?? 0)),
    keywordValuePoints: valuePoints(Number(keyword.cpc ?? 0)),
    keywordOpportunityPoints: opportunityPoints(keyword),
    keywordDemandPenalty: searchVolume < 20 && keyword.providerIntent !== "transactional" ? 3 : 0,
  };
}

export async function applyLogosKeywordPolicy<T extends RankedKeywordOpportunity>(
  keywords: T[],
  runLogic: KeywordPolicyRunner = runDestinyLogic,
): Promise<Array<LogosRankedKeywordOpportunity<T>>> {
  const evaluated = await Promise.all(keywords.map(async (keyword) => {
    const result = await runLogic(policyInput(keyword));
    if (!result.keywordEligible) return null;
    return {
      ...keyword,
      searchIntent: result.keywordSearchIntent,
      priorityTier: result.keywordPriorityTier as 1 | 2 | 3 | 4,
      priorityScore: result.keywordPriorityScore,
      verdict: result.keywordVerdict,
      ruleId: result.keywordRuleId,
      reason: result.keywordReason,
      essential: result.keywordPriorityTier === 1,
      policyCode: result.keywordPolicyCode,
      policyEngine: "logos" as const,
    };
  }));

  return evaluated.filter((keyword): keyword is LogosRankedKeywordOpportunity<T> => keyword !== null)
    .sort((left, right) => left.priorityTier - right.priorityTier
      || right.priorityScore - left.priorityScore
      || right.businessFit - left.businessFit
      || Number(right.searchVolume ?? 0) - Number(left.searchVolume ?? 0)
      || left.keyword.localeCompare(right.keyword));
}
