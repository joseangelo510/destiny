import { rankKeywordOpportunities, type KeywordBusinessContext, type KeywordCandidate } from "./keyword-opportunity";

export function prepareKeywordCandidates<T extends KeywordCandidate>(candidates: T[], context: KeywordBusinessContext): T[] {
  const scored = (item: T) => Number(item.priorityScore) > 0 && Boolean(item.priorityReason && item.themeId && item.themeLabel);
  // Missing metadata on an old audit must not discard a newly researched theme.
  return [...candidates.filter(scored), ...rankKeywordOpportunities(candidates.filter((item) => !scored(item)), context, 50)]
    .sort((left, right) => Number(right.priorityScore) - Number(left.priorityScore));
}
