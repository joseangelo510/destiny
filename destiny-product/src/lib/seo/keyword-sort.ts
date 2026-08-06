import type { KeywordResearchRow } from "./research";

export type KeywordSortKey = "keyword" | "intent" | "volume" | "difficulty" | "cpc" | "competition" | "position";
export type KeywordSortDirection = "asc" | "desc";
export type KeywordSort = { key: KeywordSortKey; direction: KeywordSortDirection };

const defaultDirection: Record<KeywordSortKey, KeywordSortDirection> = {
  keyword: "asc",
  intent: "asc",
  volume: "desc",
  difficulty: "desc",
  cpc: "desc",
  competition: "desc",
  position: "asc",
};

export function nextKeywordSort(current: KeywordSort, key: KeywordSortKey): KeywordSort {
  if (current.key !== key) return { key, direction: defaultDirection[key] };
  return { key, direction: current.direction === "asc" ? "desc" : "asc" };
}

export function sortKeywordRows(rows: KeywordResearchRow[], sort: KeywordSort) {
  return [...rows].sort((left, right) => {
    if (sort.key === "position") {
      const leftMissing = left.position <= 0;
      const rightMissing = right.position <= 0;
      if (leftMissing !== rightMissing) return leftMissing ? 1 : -1;
    }

    const leftValue = left[sort.key];
    const rightValue = right[sort.key];
    const comparison = typeof leftValue === "string" && typeof rightValue === "string"
      ? leftValue.localeCompare(rightValue, undefined, { sensitivity: "base" })
      : Number(leftValue) - Number(rightValue);
    if (comparison !== 0) return sort.direction === "asc" ? comparison : -comparison;
    return left.keyword.localeCompare(right.keyword, undefined, { sensitivity: "base" });
  });
}
