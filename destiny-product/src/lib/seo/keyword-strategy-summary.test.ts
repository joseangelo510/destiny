import { describe, expect, it } from "vitest";
import { keywordWatchlistCount } from "./keyword-strategy-summary";

describe("Keyword strategy summary", () => {
  it("uses the effective rank source so approved strategy keywords are not counted as watched", () => {
    const approvedStrategyKeywords = new Set(["approved keyword", "second strategy keyword"]);
    const tracked = [
      { keyword: "Approved Keyword", source: "manual" },
      { keyword: "second strategy keyword", source: "strategy" },
      { keyword: "watchlist keyword", source: "research" },
    ];

    expect(keywordWatchlistCount(tracked, approvedStrategyKeywords)).toBe(1);
  });
});
