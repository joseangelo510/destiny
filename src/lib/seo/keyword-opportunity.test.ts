import { describe, expect, it } from "vitest";
import { rankKeywordOpportunities } from "./keyword-opportunity";

const EMPOWERLY_CONTEXT = {
  productsServices: "College admissions counseling, application strategy, essay coaching, and college planning for high school students",
  problemSolved: "Families need expert guidance to improve college applications and admissions outcomes",
  idealCustomer: "Parents and high school students applying to selective colleges",
};

describe("keyword opportunity ranking", () => {
  it("ranks revenue-oriented admissions searches ahead of larger awareness topics", () => {
    const ranked = rankKeywordOpportunities([
      { keyword: "top colleges to get into", intent: "informational", searchVolume: 8_100, difficulty: 45, cpc: 1, opportunity: "site_idea" },
      { keyword: "college admissions consultant", intent: "commercial", searchVolume: 1_300, difficulty: 36, cpc: 18, opportunity: "competitor_gap", competitorRankers: 3 },
      { keyword: "college counselor pricing", intent: "transactional", searchVolume: 260, difficulty: 29, cpc: 24, opportunity: "competitor_gap", competitorRankers: 2 },
    ], EMPOWERLY_CONTEXT);

    expect(ranked.map((item) => item.keyword)).toEqual([
      "college counselor pricing",
      "college admissions consultant",
      "top colleges to get into",
    ]);
    expect(ranked[0]).toMatchObject({ providerIntent: "transactional", searchIntent: "conversion" });
    expect(ranked[1].priorityReason).toMatch(/buying|comparison|monthly searches|competitor/i);
    expect(ranked[2]).toMatchObject({ providerIntent: "informational", searchIntent: "awareness" });
  });

  it("keeps semantically related admissions terms without an exact vocabulary-string gate", () => {
    const ranked = rankKeywordOpportunities([
      { keyword: "admissions counseling", intent: "commercial", searchVolume: 2_400, difficulty: 37, cpc: 22, opportunity: "existing_rank", rank: 14 },
      { keyword: "college counselor", intent: "commercial", searchVolume: 6_600, difficulty: 42, cpc: 67, opportunity: "site_idea" },
      { keyword: "11 out of 12", intent: "informational", searchVolume: 900, difficulty: 10, cpc: 0, opportunity: "existing_rank" },
      { keyword: "empowerly login", intent: "navigational", searchVolume: 1_000, difficulty: 10, cpc: 0, opportunity: "existing_rank" },
    ], EMPOWERLY_CONTEXT);

    expect(ranked.map((item) => item.keyword)).toEqual(expect.arrayContaining(["admissions counseling", "college counselor"]));
    expect(ranked.map((item) => item.keyword)).not.toEqual(expect.arrayContaining(["11 out of 12", "empowerly login"]));
  });

  it("can retain a six-month-sized approval pool without padding it with noise", () => {
    const candidates = Array.from({ length: 60 }, (_, index) => ({
      keyword: index % 2 ? `college admissions counseling topic${index}` : `college application coaching guide${index}`,
      intent: index % 3 === 0 ? "transactional" : index % 3 === 1 ? "commercial" : "informational",
      searchVolume: 100 + index * 25,
      difficulty: 20 + index % 40,
      cpc: 4 + index % 12,
      opportunity: index % 2 ? "competitor_gap" : "site_idea",
      competitorRankers: index % 4,
    }));

    const ranked = rankKeywordOpportunities(candidates, EMPOWERLY_CONTEXT, 50);

    expect(ranked).toHaveLength(50);
    expect(ranked.every((item) => item.priorityScore >= 0 && item.priorityScore <= 100)).toBe(true);
    expect(ranked.every((item) => item.providerIntent && item.searchIntent && item.priorityReason)).toBe(true);
  });
});
