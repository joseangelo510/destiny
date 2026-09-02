import { effectiveRankSource } from "./rank-tracker";

type TrackedKeywordSource = {
  keyword?: string | null;
  normalized_keyword?: string | null;
  source?: string | null;
};

export function keywordWatchlistCount(rows: TrackedKeywordSource[], approvedStrategyKeywords: Set<string>) {
  return rows.filter((row) => effectiveRankSource(row.keyword ?? row.normalized_keyword ?? "", row.source ?? "", approvedStrategyKeywords) !== "strategy").length;
}
