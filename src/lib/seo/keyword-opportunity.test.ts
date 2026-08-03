import { describe, expect, it } from "vitest";
import { keywordHasGeographicConflict, rankKeywordOpportunities, selectDiversifiedKeywordOpportunities } from "./keyword-opportunity";

const EMPOWERLY_CONTEXT = {
  productsServices: "College admissions counseling, application strategy, essay coaching, and college planning for high school students",
  problemSolved: "Families need expert guidance to improve college applications and admissions outcomes",
  idealCustomer: "Parents and high school students applying to selective colleges",
};

const LOGICAFFEINE_CONTEXT = {
  productsServices: "We build software and firmware for datacenters. Our core product is a general purpose programming language called Logos that is the fastest in the world. It is based on English syntax to make programming accessible to anyone that knows English.",
  problemSolved: "Datacenter power constraints, processing speeds, code is unreadable by anyone that doesn't know the specific coding language.",
  idealCustomer: "data center developers, software developers, vibe coders",
  audienceChallengesGoals: "Use English and reduce power consumption of datacenter high-performance compute processing.",
  differentiation: "The programming language has a SAT solver and super compiler and transpiles hardware specifications into System Verilog Assertions for provably bug-free chip architecture.",
};

const LOGICAFFEINE_BRIEF = {
  source: "claude-opus-4-8" as const,
  model: "claude-opus-4-8",
  businessSummary: "Logos is an English-syntax programming language for high-performance software, datacenter, and hardware development.",
  offerVsEnablement: {
    whatCompanySells: ["Logos programming language", "datacenter software and firmware"],
    whatProductEnables: ["software development", "hardware verification"],
    notTheOffer: ["project management software", "CRM software", "house design software", "deck design software"],
  },
  audiences: ["datacenter developers", "software developers", "vibe coders"],
  problems: ["datacenter power consumption", "unreadable code", "hardware bugs"],
  differentiators: ["English syntax", "SAT solver", "super compiler", "System Verilog Assertions"],
  themes: [
    { id: "language", label: "Programming language", funnelRole: "consideration" as const, priority: "primary" as const, seedKeywords: ["general purpose programming language", "programming language for developers"], requiredTerms: ["programming language", "logos"], negativeTerms: ["project management", "house", "deck", "bridge", "crm", "human resources"], evidence: [{ field: "productsServices" as const, quote: "general purpose programming language" }] },
    { id: "datacenter", label: "Datacenter efficiency", funnelRole: "awareness" as const, priority: "primary" as const, seedKeywords: ["datacenter power consumption", "high performance compute language"], requiredTerms: ["datacenter", "high performance compute"], negativeTerms: [], evidence: [{ field: "audienceChallengesGoals" as const, quote: "datacenter high-performance compute" }] },
    { id: "accessibility", label: "English syntax", funnelRole: "awareness" as const, priority: "supporting" as const, seedKeywords: ["English syntax programming language", "programming language for vibe coders"], requiredTerms: ["English syntax", "vibe coders"], negativeTerms: [], evidence: [{ field: "productsServices" as const, quote: "English syntax" }] },
    { id: "compiler", label: "Compiler performance", funnelRole: "consideration" as const, priority: "primary" as const, seedKeywords: ["fastest programming language", "super compiler"], requiredTerms: ["programming language", "super compiler"], negativeTerms: [], evidence: [{ field: "differentiation" as const, quote: "super compiler" }] },
    { id: "hardware", label: "Hardware verification", funnelRole: "technical_authority" as const, priority: "primary" as const, seedKeywords: ["System Verilog Assertions", "SAT solver hardware verification", "provably bug free chip architecture"], requiredTerms: ["System Verilog", "SAT solver", "chip architecture"], negativeTerms: [], evidence: [{ field: "differentiation" as const, quote: "System Verilog Assertions" }] },
  ],
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

  it("uses the full semantic brief to reject generic build categories from LogicCaffeine", () => {
    const ranked = rankKeywordOpportunities([
      { keyword: "build project management software", intent: "transactional", searchVolume: 8_100, difficulty: 34, cpc: 116, opportunity: "site_idea" },
      { keyword: "build a house software", intent: "transactional", searchVolume: 480, difficulty: 58, cpc: 7, opportunity: "site_idea" },
      { keyword: "cloud based HR software", intent: "commercial", searchVolume: 9_900, difficulty: 42, cpc: 12, opportunity: "site_idea" },
      { keyword: "general purpose programming language", intent: "commercial", searchVolume: 1_300, difficulty: 34, cpc: 8, opportunity: "site_idea" },
      { keyword: "English syntax programming language", intent: "informational", searchVolume: 170, difficulty: 22, cpc: 2, opportunity: "site_idea" },
      { keyword: "reduce datacenter power consumption", intent: "informational", searchVolume: 390, difficulty: 30, cpc: 4, opportunity: "site_idea" },
      { keyword: "SAT solver hardware verification", intent: "commercial", searchVolume: 110, difficulty: 28, cpc: 6, opportunity: "site_idea" },
      { keyword: "System Verilog Assertions", intent: "informational", searchVolume: 720, difficulty: 31, cpc: 3, opportunity: "existing_rank", rank: 18 },
    ], LOGICAFFEINE_CONTEXT, 50, LOGICAFFEINE_BRIEF);

    expect(ranked.map((item) => item.keyword)).toEqual(expect.arrayContaining([
      "general purpose programming language",
      "English syntax programming language",
      "reduce datacenter power consumption",
      "SAT solver hardware verification",
      "System Verilog Assertions",
    ]));
    expect(ranked.map((item) => item.keyword)).not.toEqual(expect.arrayContaining([
      "build project management software",
      "build a house software",
      "cloud based HR software",
    ]));
    expect(new Set(ranked.map((item) => item.themeId)).size).toBeGreaterThanOrEqual(4);
  });

  it("caps one keyword theme and near-duplicate wording instead of letting it dominate all 50", () => {
    const languageModifiers = ["best", "fastest", "modern", "general purpose", "high performance", "developer friendly", "plain english", "new", "efficient", "compiled", "systems", "accessible", "enterprise", "comparison", "alternatives", "reviews", "features", "benchmarks", "syntax", "tools"];
    const datacenterModifiers = ["reduce", "optimize", "measure", "lower", "manage", "improve", "cut", "monitor"];
    const accessibilityModifiers = ["accessible", "easy", "plain", "natural", "readable", "beginner", "developer", "vibe coder"];
    const hardwareModifiers = ["chip", "formal", "automated", "provable", "computer", "digital", "fpga", "asic"];
    const compilerModifiers = ["fast", "optimizing", "advanced", "modern", "efficient", "systems", "parallel", "high performance"];
    const ranked = rankKeywordOpportunities([
      ...languageModifiers.flatMap((modifier, index) => [
        { keyword: `${modifier} programming language`, intent: "commercial", searchVolume: 1_000 - index, difficulty: 30, cpc: 9, opportunity: "site_idea" },
        { keyword: `programming language ${modifier} guide`, intent: "commercial", searchVolume: 900 - index, difficulty: 30, cpc: 9, opportunity: "site_idea" },
      ]),
      ...datacenterModifiers.map((modifier, index) => ({ keyword: `${modifier} datacenter power consumption`, intent: "informational", searchVolume: 500 - index, difficulty: 28, cpc: 4, opportunity: "site_idea" })),
      ...accessibilityModifiers.map((modifier, index) => ({ keyword: `${modifier} English syntax programming language`, intent: "informational", searchVolume: 400 - index, difficulty: 24, cpc: 3, opportunity: "site_idea" })),
      ...hardwareModifiers.map((modifier, index) => ({ keyword: `SAT solver ${modifier} hardware verification`, intent: "commercial", searchVolume: 300 - index, difficulty: 26, cpc: 5, opportunity: "site_idea" })),
      ...compilerModifiers.map((modifier, index) => ({ keyword: `${modifier} super compiler performance`, intent: "commercial", searchVolume: 200 - index, difficulty: 20, cpc: 6, opportunity: "site_idea" })),
    ], LOGICAFFEINE_CONTEXT, 100, LOGICAFFEINE_BRIEF);
    const diversified = selectDiversifiedKeywordOpportunities(ranked, 50);
    const counts = diversified.reduce<Record<string, number>>((totals, keyword) => {
      totals[keyword.themeId] = (totals[keyword.themeId] ?? 0) + 1;
      return totals;
    }, {});

    expect(diversified.length).toBeGreaterThanOrEqual(30);
    expect(Math.max(...Object.values(counts))).toBeLessThanOrEqual(15);
    expect(Object.keys(counts).length).toBeGreaterThanOrEqual(4);
  });
});

describe("theme preservation through re-ranking", () => {
  // A property-management business context ensures "property managers near me"
  // passes the relevance gate (BUYER_ACTION matches "near me"; offer overlaps
  // "property"). Without a BusinessSearchBrief the themeMatch is always null,
  // so the fix must forward the candidate's persisted themeId/themeLabel/themeRole
  // instead of overwriting them with "evidence-based"/"Evidence-based opportunity".
  const PROPERTY_MGMT_CONTEXT = {
    productsServices: "residential property management, tenant screening, rent collection, lease management",
    problemSolved: "Property owners need help managing rental properties and tenants",
    idealCustomer: "Real estate investors and rental property owners",
  };

  it("preserves a persisted Audience use cases themeLabel when no brief theme matches", () => {
    const ranked = rankKeywordOpportunities([{
      keyword: "property managers near me",
      intent: "transactional",
      searchVolume: 400,
      difficulty: 20,
      opportunity: "site_idea",
      themeId: "audience-use-cases",
      themeLabel: "Audience use cases",
      themeRole: "awareness",
    }], PROPERTY_MGMT_CONTEXT);

    const result = ranked.find((kw) => kw.keyword === "property managers near me");
    expect(result).toBeDefined();
    expect(result!.themeId).toBe("audience-use-cases");
    expect(result!.themeLabel).toBe("Audience use cases");
    expect(result!.themeRole).toBe("awareness");
  });

  it("overwrites a persisted theme when a new brief match is found", () => {
    // Full BusinessSearchBrief shape — every required field must be present or
    // keywordThemeMatch crashes reading offerVsEnablement.notTheOffer.
    const PROPERTY_MGMT_BRIEF = {
      source: "claude-opus-4-8" as const,
      model: "claude-opus-4-8",
      businessSummary: "Residential property management providing tenant screening, rent collection, and lease management.",
      offerVsEnablement: {
        whatCompanySells: ["property management services", "tenant screening", "rent collection"],
        whatProductEnables: ["property owners to earn passive income"],
        notTheOffer: ["real estate buying", "mortgage services"],
      },
      audiences: ["real estate investors", "rental property owners"],
      problems: ["managing tenants", "collecting rent", "delinquent payments"],
      differentiators: ["local property managers", "24/7 maintenance response"],
      themes: [{
        id: "property-mgmt-services",
        label: "Property management services",
        funnelRole: "conversion" as const,
        priority: "primary" as const,
        // "property manager" → canonical tokens ["property","manager"] both appear in
        // "property managers near me" → requiredMatches = 1; seed overlap >= 0.25.
        seedKeywords: ["find property managers near me", "local property manager", "hire property manager"],
        requiredTerms: ["property manager"],
        negativeTerms: ["real estate agent", "mortgage"],
        evidence: [{ field: "productsServices" as const, quote: "property management" }],
      }],
    };

    const ranked = rankKeywordOpportunities([{
      keyword: "property managers near me",
      intent: "transactional",
      searchVolume: 400,
      difficulty: 20,
      opportunity: "site_idea",
      themeId: "audience-use-cases",
      themeLabel: "Audience use cases",
      themeRole: "awareness",
    }], PROPERTY_MGMT_CONTEXT, 50, PROPERTY_MGMT_BRIEF);

    const result = ranked.find((kw) => kw.keyword === "property managers near me");
    expect(result).toBeDefined();
    // Brief match wins — should NOT preserve the stale persisted theme.
    expect(result!.themeId).toBe("property-mgmt-services");
    expect(result!.themeLabel).toBe("Property management services");
    expect(result!.themeRole).toBe("conversion");
  });

  it("falls back to evidence-based when no brief and no persisted theme", () => {
    const ranked = rankKeywordOpportunities([{
      keyword: "property managers near me",
      intent: "transactional",
      searchVolume: 400,
      difficulty: 20,
    }], PROPERTY_MGMT_CONTEXT);

    const result = ranked.find((kw) => kw.keyword === "property managers near me");
    expect(result).toBeDefined();
    expect(result!.themeId).toBe("evidence-based");
    expect(result!.themeLabel).toBe("Evidence-based opportunity");
  });
});

describe("keywordHasGeographicConflict", () => {
  const fremonEvidence = "junk removal fremont bay area east bay california hauling debris";

  it("flags keywords with city names absent from page-text evidence (98junkit.com pattern)", () => {
    expect(keywordHasGeographicConflict("junk removal los angeles", fremonEvidence)).toBe(true);
    expect(keywordHasGeographicConflict("junk removal manhattan", fremonEvidence)).toBe(true);
    expect(keywordHasGeographicConflict("junk removal boston", fremonEvidence)).toBe(true);
    expect(keywordHasGeographicConflict("junk removal houston", fremonEvidence)).toBe(true);
    expect(keywordHasGeographicConflict("junk removal green bay", fremonEvidence)).toBe(true);
    expect(keywordHasGeographicConflict("junk removal seattle", fremonEvidence)).toBe(true);
    expect(keywordHasGeographicConflict("junk removal chicago", fremonEvidence)).toBe(true);
    expect(keywordHasGeographicConflict("junk removal philadelphia", fremonEvidence)).toBe(true);
    // Extended local-market regression — unsupported secondary US cities.
    expect(keywordHasGeographicConflict("junk removal services tucson", fremonEvidence)).toBe(true);
    expect(keywordHasGeographicConflict("junk removal services york pa", fremonEvidence)).toBe(true);
    expect(keywordHasGeographicConflict("roswell junk removal", fremonEvidence)).toBe(true);
    expect(keywordHasGeographicConflict("junk removal columbus", fremonEvidence)).toBe(true);
    expect(keywordHasGeographicConflict("junk removal madison", fremonEvidence)).toBe(true);
  });

  it("passes keywords whose city appears in the page-text evidence", () => {
    expect(keywordHasGeographicConflict("junk removal fremont", fremonEvidence)).toBe(false);
    expect(keywordHasGeographicConflict("bay area junk removal", fremonEvidence)).toBe(false);
  });

  it("passes non-geographic keywords unconditionally", () => {
    expect(keywordHasGeographicConflict("same day junk removal", fremonEvidence)).toBe(false);
    expect(keywordHasGeographicConflict("junk removal near me", fremonEvidence)).toBe(false);
    expect(keywordHasGeographicConflict("debris hauling cost", fremonEvidence)).toBe(false);
  });

  it("passes everything when evidence is empty", () => {
    expect(keywordHasGeographicConflict("junk removal chicago", "")).toBe(false);
    expect(keywordHasGeographicConflict("los angeles hauling", "   ")).toBe(false);
  });
});
