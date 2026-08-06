import { describe, expect, it } from "vitest";
import type { KeywordResearchRow } from "./research";
import { nextKeywordSort, sortKeywordRows } from "./keyword-sort";

function row(overrides: Partial<KeywordResearchRow>): KeywordResearchRow {
  return {
    keyword: "keyword",
    intent: "unknown",
    volume: 0,
    difficulty: 0,
    cpc: 0,
    competition: 0,
    trend: [],
    position: 0,
    traffic: 0,
    url: "",
    ...overrides,
  };
}

describe("keyword research sorting", () => {
  const rows = [
    row({ keyword: "Zebra", intent: "transactional", volume: 90, position: 1 }),
    row({ keyword: "apple", intent: "commercial", volume: 900, position: 18 }),
    row({ keyword: "Middle", intent: "informational", volume: 300, position: 4 }),
    row({ keyword: "Unranked", intent: "unknown", volume: 20, position: 0 }),
  ];

  it("puts position one first when sorting by best ranking", () => {
    expect(sortKeywordRows(rows, { key: "position", direction: "asc" }).map((item) => item.position)).toEqual([1, 4, 18, 0]);
  });

  it("reverses ranked positions while keeping missing positions last", () => {
    expect(sortKeywordRows(rows, { key: "position", direction: "desc" }).map((item) => item.position)).toEqual([18, 4, 1, 0]);
  });

  it("sorts keyword, intent, and volume in either direction", () => {
    expect(sortKeywordRows(rows, { key: "keyword", direction: "asc" })[0].keyword).toBe("apple");
    expect(sortKeywordRows(rows, { key: "intent", direction: "desc" })[0].intent).toBe("unknown");
    expect(sortKeywordRows(rows, { key: "volume", direction: "desc" })[0].volume).toBe(900);
    expect(sortKeywordRows(rows, { key: "volume", direction: "asc" })[0].volume).toBe(20);
  });

  it("uses the useful default direction for a newly selected column and toggles it", () => {
    expect(nextKeywordSort({ key: "volume", direction: "desc" }, "position")).toEqual({ key: "position", direction: "asc" });
    expect(nextKeywordSort({ key: "position", direction: "asc" }, "position")).toEqual({ key: "position", direction: "desc" });
    expect(nextKeywordSort({ key: "position", direction: "desc" }, "keyword")).toEqual({ key: "keyword", direction: "asc" });
  });
});
