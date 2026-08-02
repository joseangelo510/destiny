import { describe, expect, it } from "vitest";
import { rankKeywordOpportunities } from "./keyword-opportunity";

const EMPOWERLY_CONTEXT = {
  productsServices: "College admissions counseling, application strategy, essay coaching, and college planning for high school students",
  problemSolved: "Families need expert guidance to improve college applications and admissions outcomes",
  idealCustomer: "Parents and high school students applying to selective colleges",
};

describe("keyword opportunity ranking", () => {
  it("rejects unrelated high-volume keywords that only share generic onboarding words", () => {
    const ranked = rankKeywordOpportunities([
      { keyword: "best savings account high-yield", intent: "commercial", searchVolume: 1_000_000, difficulty: 37, cpc: 15.23, opportunity: "competitor_gap", competitorRankers: 2 },
      { keyword: "college counselor", intent: "commercial", searchVolume: 6_600, difficulty: 42, cpc: 67.88, opportunity: "existing_rank", rank: 1 },
    ], EMPOWERLY_CONTEXT);

    expect(ranked.map((item) => item.keyword)).toEqual(["college counselor"]);
  });

  it("puts hiring, pricing, and service-comparison queries ahead of broad research", () => {
    const ranked = rankKeywordOpportunities([
      { keyword: "top colleges to get into", intent: "informational", searchVolume: 8_100, difficulty: 45, cpc: 1, opportunity: "site_idea" },
      { keyword: "best colleges for autism spectrum students", intent: "commercial", searchVolume: 140, difficulty: 26, cpc: 2.4, opportunity: "competitor_gap", competitorRankers: 2 },
      { keyword: "where to hire a private college counselor", intent: "transactional", searchVolume: 170, difficulty: 31, cpc: 22, opportunity: "site_idea" },
      { keyword: "best college counseling companies", intent: "commercial", searchVolume: 480, difficulty: 39, cpc: 19, opportunity: "competitor_gap", competitorRankers: 3, directCompetitorRankers: 2 },
      { keyword: "college counselor", intent: "commercial", searchVolume: 6_600, difficulty: 42, cpc: 67, opportunity: "existing_rank", rank: 1 },
      { keyword: "admissions counseling", intent: "commercial", searchVolume: 2_400, difficulty: 37, cpc: 22, opportunity: "existing_rank", rank: 1 },
    ], EMPOWERLY_CONTEXT);

    expect(ranked.slice(0, 4).map((item) => item.keyword)).toEqual(expect.arrayContaining([
      "where to hire a private college counselor",
      "best college counseling companies",
      "college counselor",
      "admissions counseling",
    ]));
    expect(ranked.findIndex((item) => item.keyword === "top colleges to get into"))
      .toBeGreaterThan(ranked.findIndex((item) => item.keyword === "best college counseling companies"));
    expect(ranked.find((item) => item.keyword === "where to hire a private college counselor"))
      .toMatchObject({ searchIntent: "conversion", relevanceTier: "core", priorityTier: 1 });
    expect(ranked.find((item) => item.keyword === "best colleges for autism spectrum students"))
      .toMatchObject({ relevanceTier: "adjacent", priorityTier: 4 });
    expect(ranked.find((item) => item.keyword === "top colleges to get into")?.priorityTier).toBe(4);
  });

  it("rejects bare university navigation while retaining useful admissions research variants", () => {
    const ranked = rankKeywordOpportunities([
      { keyword: "University of Pennsylvania Philadelphia", intent: "navigational", searchVolume: 14_800, difficulty: 63, cpc: 3, opportunity: "competitor_gap", competitorRankers: 3 },
      { keyword: "Vanderbilt University", intent: "navigational", searchVolume: 90_500, difficulty: 72, cpc: 2, opportunity: "competitor_gap", competitorRankers: 3 },
      { keyword: "University of Pennsylvania acceptance rate", intent: "informational", searchVolume: 12_100, difficulty: 49, cpc: 4, opportunity: "competitor_gap", competitorRankers: 2 },
      { keyword: "how to get into University of Pennsylvania", intent: "informational", searchVolume: 1_300, difficulty: 36, cpc: 5, opportunity: "site_idea" },
    ], EMPOWERLY_CONTEXT);

    expect(ranked.map((item) => item.keyword)).toEqual(expect.arrayContaining([
      "University of Pennsylvania acceptance rate",
      "how to get into University of Pennsylvania",
    ]));
    expect(ranked.map((item) => item.keyword)).not.toEqual(expect.arrayContaining([
      "University of Pennsylvania Philadelphia",
      "Vanderbilt University",
    ]));
  });

  it("weights direct business competitors more than publisher-only search overlap", () => {
    const ranked = rankKeywordOpportunities([
      { keyword: "college admissions consultant reviews", intent: "commercial", searchVolume: 320, difficulty: 38, cpc: 13, opportunity: "competitor_gap", competitorRankers: 2, directCompetitorRankers: 2 },
      { keyword: "college admissions consulting guide", intent: "commercial", searchVolume: 320, difficulty: 38, cpc: 13, opportunity: "competitor_gap", competitorRankers: 4, directCompetitorRankers: 0 },
    ], EMPOWERLY_CONTEXT);

    expect(ranked[0].keyword).toBe("college admissions consultant reviews");
    expect(ranked[0].priorityReason).toMatch(/direct competitor/i);
  });

  it("rejects an incompatible graduate-school audience even when admissions words overlap", () => {
    const ranked = rankKeywordOpportunities([
      { keyword: "writing essay for MBA admissions", intent: "commercial", searchVolume: 1_000, difficulty: 31, cpc: 11, opportunity: "site_idea" },
      { keyword: "college application essay counseling", intent: "commercial", searchVolume: 390, difficulty: 29, cpc: 16, opportunity: "site_idea" },
    ], EMPOWERLY_CONTEXT);

    expect(ranked.map((item) => item.keyword)).toEqual(["college application essay counseling"]);
  });

  it("rejects ambiguous guidance queries unless a distinctive college-admissions anchor is present", () => {
    const ranked = rankKeywordOpportunities([
      { keyword: "fee waiver application guidance", intent: "transactional", searchVolume: 10, difficulty: 4, cpc: 1, opportunity: "site_idea" },
      { keyword: "opm retirement application guidance", intent: "transactional", searchVolume: 110, difficulty: 9, cpc: 2, opportunity: "site_idea" },
      { keyword: "move forward counseling", intent: "transactional", searchVolume: 1_900, difficulty: 13, cpc: 3, opportunity: "site_idea" },
      { keyword: "guidance counselor application letter", intent: "transactional", searchVolume: 10, difficulty: 5, cpc: 1, opportunity: "site_idea" },
      { keyword: "college application guidance", intent: "commercial", searchVolume: 260, difficulty: 22, cpc: 11, opportunity: "site_idea" },
      { keyword: "college admissions counseling", intent: "commercial", searchVolume: 1_300, difficulty: 33, cpc: 18, opportunity: "site_idea" },
    ], EMPOWERLY_CONTEXT);

    expect(ranked.map((item) => item.keyword)).toEqual(expect.arrayContaining([
      "college application guidance",
      "college admissions counseling",
    ]));
    expect(ranked.map((item) => item.keyword)).not.toEqual(expect.arrayContaining([
      "fee waiver application guidance",
      "opm retirement application guidance",
      "move forward counseling",
      "guidance counselor application letter",
    ]));
  });

  it("rejects bare institution queries even when the provider misclassifies their intent", () => {
    const ranked = rankKeywordOpportunities([
      { keyword: "Cornell University in USA", intent: "informational", searchVolume: 201_000, difficulty: 64, cpc: 5, opportunity: "competitor_gap", competitorRankers: 3 },
      { keyword: "Rice University in Texas", intent: "informational", searchVolume: 201_000, difficulty: 49, cpc: 4, opportunity: "competitor_gap", competitorRankers: 2 },
      { keyword: "Cornell University acceptance rate", intent: "informational", searchVolume: 18_100, difficulty: 48, cpc: 4, opportunity: "competitor_gap", competitorRankers: 2 },
      { keyword: "top colleges to get into", intent: "informational", searchVolume: 8_100, difficulty: 45, cpc: 1, opportunity: "site_idea" },
    ], EMPOWERLY_CONTEXT);

    expect(ranked.map((item) => item.keyword)).toEqual(expect.arrayContaining([
      "Cornell University acceptance rate",
      "top colleges to get into",
    ]));
    expect(ranked.map((item) => item.keyword)).not.toEqual(expect.arrayContaining([
      "Cornell University in USA",
      "Rice University in Texas",
    ]));
  });

  it("retains verified school-specific admissions research from direct competitors", () => {
    const ranked = rankKeywordOpportunities([
      { keyword: "how to get into harvard", intent: "informational", searchVolume: 27_100, difficulty: 51, cpc: 6, opportunity: "competitor_gap", competitorRankers: 3, directCompetitorRankers: 2 },
      { keyword: "harvard acceptance rate", intent: "informational", searchVolume: 90_500, difficulty: 58, cpc: 4, opportunity: "competitor_gap", competitorRankers: 3, directCompetitorRankers: 2 },
      { keyword: "how to get into a locked car", intent: "informational", searchVolume: 12_100, difficulty: 30, cpc: 2, opportunity: "site_idea", competitorRankers: 0, directCompetitorRankers: 0 },
    ], EMPOWERLY_CONTEXT);

    expect(ranked.map((item) => item.keyword)).toEqual(expect.arrayContaining([
      "how to get into harvard",
      "harvard acceptance rate",
    ]));
    expect(ranked.every((item) => item.relevanceTier === "adjacent" && item.priorityTier === 4)).toBe(true);
    expect(ranked.map((item) => item.keyword)).not.toContain("how to get into a locked car");
  });

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
      { keyword: "admissions counseling", intent: "", searchVolume: 2_400, difficulty: 37, cpc: 22, opportunity: "existing_rank", rank: 14 },
      { keyword: "college counselor", intent: "commercial", searchVolume: 6_600, difficulty: 42, cpc: 67, opportunity: "site_idea" },
      { keyword: "admissions software for colleges", intent: "commercial", searchVolume: 1_300, difficulty: 20, cpc: 18, opportunity: "site_idea" },
      { keyword: "11 out of 12", intent: "informational", searchVolume: 900, difficulty: 10, cpc: 0, opportunity: "existing_rank" },
      { keyword: "empowerly login", intent: "navigational", searchVolume: 1_000, difficulty: 10, cpc: 0, opportunity: "existing_rank" },
    ], EMPOWERLY_CONTEXT);

    expect(ranked.map((item) => item.keyword)).toEqual(expect.arrayContaining(["admissions counseling", "college counselor"]));
    expect(ranked.find((item) => item.keyword === "admissions counseling")).toMatchObject({
      providerIntent: "commercial",
      searchIntent: "consideration",
      relevanceTier: "core",
      priorityTier: 1,
    });
    expect(ranked.map((item) => item.keyword)).not.toEqual(expect.arrayContaining(["11 out of 12", "empowerly login", "admissions software for colleges"]));
  });

  it("treats admissions counseling as a core service when admissions appears elsewhere in the business context", () => {
    const ranked = rankKeywordOpportunities([
      { keyword: "admissions counseling", intent: "commercial", searchVolume: 2_400, difficulty: 37, cpc: 22, opportunity: "existing_rank", rank: 1 },
      { keyword: "move forward counseling", intent: "transactional", searchVolume: 1_900, difficulty: 13, cpc: 3, opportunity: "site_idea" },
    ], {
      productsServices: "college counseling service for high school students",
      problemSolved: "families need help with college applications and essays",
      idealCustomer: "high school students who need college admissions support",
    });

    expect(ranked).toHaveLength(1);
    expect(ranked[0]).toMatchObject({ keyword: "admissions counseling", relevanceTier: "core", priorityTier: 1 });
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
