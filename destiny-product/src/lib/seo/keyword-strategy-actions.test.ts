import { describe, expect, it } from "vitest";
import { keywordStrategyAction } from "./keyword-strategy-actions";

describe("keywordStrategyAction", () => {
  it("defends a verified top-three page", () => {
    expect(keywordStrategyAction({ rank: 2, rankBucket: 1, rankingUrls: ["https://example.com/service"] })).toEqual({
      verdict: "defend",
      description: "Already winning · protect this page",
    });
  });

  it("improves a page that exists outside the top three", () => {
    expect(keywordStrategyAction({ rank: 14, rankBucket: 3, rankingUrls: ["https://example.com/service"] }).verdict).toBe("improve");
  });

  it("creates a page only when no current page is verified", () => {
    expect(keywordStrategyAction({ rank: 0, rankBucket: 0, rankingUrls: [] })).toEqual({
      verdict: "create",
      description: "No page is verified for this search",
    });
  });

  it("flags overlap only when two current ranking URLs are verified", () => {
    expect(keywordStrategyAction({ rank: 18, rankBucket: 3, rankingUrls: ["https://example.com/a", "https://example.com/b"] })).toEqual({
      verdict: "overlap",
      description: "2 pages may be splitting relevance",
    });
  });
});
