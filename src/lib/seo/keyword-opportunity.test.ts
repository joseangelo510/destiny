import { describe, expect, it } from "vitest";
import { rankKeywordOpportunities, selectDiversifiedKeywordOpportunities } from "./keyword-opportunity";

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
  it("rejects unrelated tails from live 98 Junk It discovery while preserving buyer keywords", () => {
    const ranked = rankKeywordOpportunities([
      { keyword: "commercial junk removal near me", intent: "commercial", searchVolume: 2_900, opportunity: "site_idea" },
      { keyword: "office furniture removal", intent: "transactional", searchVolume: 1_300, opportunity: "site_idea" },
      { keyword: "same day furniture removal", intent: "transactional", searchVolume: 170, opportunity: "site_idea" },
      { keyword: "furniture mold removal", intent: "commercial", searchVolume: 590, opportunity: "site_idea" },
      { keyword: "furniture stain removal", intent: "commercial", searchVolume: 1_000, opportunity: "site_idea" },
      { keyword: "furniture wax removal", intent: "commercial", searchVolume: 260, opportunity: "site_idea" },
      { keyword: "furniture smell removal", intent: "commercial", searchVolume: 170, opportunity: "site_idea" },
      { keyword: "loadup furniture removal", intent: "commercial", searchVolume: 110, opportunity: "site_idea" },
    ], {
      productsServices: "Residential and commercial junk removal, furniture removal, appliance hauling, estate cleanouts, and office cleanouts",
      idealCustomer: "Homeowners, property managers, real estate agents, and businesses in the San Francisco Bay Area",
      problemSolved: "Customers need unwanted furniture, appliances, and debris hauled away quickly",
    });

    expect(ranked.map((item) => item.keyword)).toEqual(expect.arrayContaining([
      "commercial junk removal near me",
      "office furniture removal",
      "same day furniture removal",
    ]));
    expect(ranked.map((item) => item.keyword)).not.toEqual(expect.arrayContaining([
      "furniture mold removal",
      "furniture stain removal",
      "furniture wax removal",
      "furniture smell removal",
      "loadup furniture removal",
    ]));
  });

  it("rejects unrelated coaching and essay tails from live Empowerly discovery", () => {
    const ranked = rankKeywordOpportunities([
      { keyword: "college counselor", intent: "commercial", searchVolume: 6_600, opportunity: "site_idea" },
      { keyword: "admissions counseling", intent: "commercial", searchVolume: 2_400, opportunity: "site_idea" },
      { keyword: "college application essay coaching", intent: "commercial", searchVolume: 390, opportunity: "site_idea" },
      { keyword: "coaching leadership style essay", intent: "informational", searchVolume: 720, opportunity: "site_idea" },
      { keyword: "coaching and mentoring reflective essay", intent: "informational", searchVolume: 170, opportunity: "site_idea" },
      { keyword: "essay coaching for UPSC", intent: "commercial", searchVolume: 110, opportunity: "site_idea" },
      { keyword: "prompt essay coaching reviews", intent: "commercial", searchVolume: 90, opportunity: "site_idea" },
      { keyword: "essay coaching by Debbie Merion", intent: "commercial", searchVolume: 90, opportunity: "site_idea" },
    ], EMPOWERLY_CONTEXT);

    expect(ranked.map((item) => item.keyword)).toEqual(expect.arrayContaining([
      "college counselor",
      "admissions counseling",
      "college application essay coaching",
    ]));
    expect(ranked.map((item) => item.keyword)).not.toEqual(expect.arrayContaining([
      "coaching leadership style essay",
      "coaching and mentoring reflective essay",
      "essay coaching for UPSC",
      "prompt essay coaching reviews",
      "essay coaching by Debbie Merion",
    ]));
  });

  it("classifies institution research as awareness even when a provider labels it commercial", () => {
    const ranked = rankKeywordOpportunities([
      { keyword: "high point university acceptance rate", intent: "commercial", searchVolume: 14_800, opportunity: "site_idea", directCompetitorRankers: 1 },
    ], EMPOWERLY_CONTEXT);

    expect(ranked[0]).toMatchObject({ providerIntent: "informational", searchIntent: "awareness" });
  });

  it("rejects unmeasured onboarding fragments and proof points instead of padding the pool", () => {
    const ranked = rankKeywordOpportunities([
      { keyword: "served fremont", intent: "transactional", searchVolume: 10, opportunity: "site_idea" },
      { keyword: "customers need fast", intent: "transactional", searchVolume: 0, opportunity: "site_idea" },
      { keyword: "earned more than 200 five star reviews", intent: "commercial", searchVolume: 10, opportunity: "site_idea" },
      { keyword: "finish moves", intent: "informational", searchVolume: 0, opportunity: "site_idea" },
      { keyword: "united states", intent: "informational", searchVolume: 0, opportunity: "site_idea" },
      { keyword: "commercial junk removal services", intent: "commercial", searchVolume: 590, opportunity: "site_idea" },
    ], {
      productsServices: "Residential and commercial junk removal in Fremont and the Bay Area",
      differentiation: "Served Fremont for 20 years with more than 200 five-star reviews",
    });

    expect(ranked.map((item) => item.keyword)).toEqual(["commercial junk removal services"]);
    expect(ranked.every((item) => Number(item.searchVolume) > 0)).toBe(true);
  });

  it("requires audience and outcome themes to stay attached to the service being sold", () => {
    const junkBrief = {
      source: "deterministic" as const,
      model: null,
      businessSummary: "98 Junk It removes residential and commercial junk in Fremont.",
      offerVsEnablement: {
        whatCompanySells: ["junk removal", "property cleanouts", "construction debris hauling"],
        whatProductEnables: ["finish moves", "prepare properties for sale"],
        notTheOffer: [],
      },
      audiences: ["property managers", "real estate professionals"],
      problems: ["unwanted furniture and debris"],
      differentiators: ["200 five-star reviews"],
      themes: [
        { id: "services", label: "Junk removal services", funnelRole: "conversion" as const, priority: "primary" as const, seedKeywords: ["junk removal", "property cleanouts", "construction debris hauling"], requiredTerms: ["junk removal", "cleanouts", "debris hauling"], negativeTerms: ["property management", "real estate CRM"], evidence: [{ field: "productsServices" as const, quote: "residential and commercial junk removal" }] },
        { id: "audiences", label: "Audience use cases", funnelRole: "consideration" as const, priority: "secondary" as const, seedKeywords: ["property managers", "real estate professionals"], requiredTerms: ["property managers", "real estate professionals"], negativeTerms: [], evidence: [{ field: "idealCustomer" as const, quote: "property managers and real estate professionals" }] },
        { id: "outcomes", label: "Customer outcomes", funnelRole: "awareness" as const, priority: "secondary" as const, seedKeywords: ["finish moves", "prepare properties for sale"], requiredTerms: ["finish moves", "properties for sale"], negativeTerms: [], evidence: [{ field: "audienceChallengesGoals" as const, quote: "finish moves and prepare properties for sale" }] },
      ],
    };
    const ranked = rankKeywordOpportunities([
      { keyword: "property managers cost", intent: "transactional", searchVolume: 2_900, opportunity: "site_idea" },
      { keyword: "rental property managers near me", intent: "transactional", searchVolume: 2_900, opportunity: "site_idea" },
      { keyword: "commercial real estate property managers", intent: "commercial", searchVolume: 5_400, opportunity: "site_idea" },
      { keyword: "real estate CRM", intent: "commercial", searchVolume: 4_400, opportunity: "site_idea" },
      { keyword: "renovation schedule", intent: "transactional", searchVolume: 320, opportunity: "site_idea" },
      { keyword: "junk removal for property managers", intent: "commercial", searchVolume: 170, opportunity: "site_idea" },
      { keyword: "pre listing junk removal", intent: "commercial", searchVolume: 90, opportunity: "site_idea" },
      { keyword: "construction debris hauling", intent: "commercial", searchVolume: 480, opportunity: "site_idea" },
    ], {
      productsServices: "Residential and commercial junk removal, property cleanouts, and construction debris hauling",
      idealCustomer: "Property managers, real estate professionals, homeowners, and contractors",
      audienceChallengesGoals: "Finish moves and prepare properties for sale",
    }, 50, junkBrief);

    expect(ranked.map((item) => item.keyword)).toEqual(expect.arrayContaining([
      "junk removal for property managers",
      "pre listing junk removal",
      "construction debris hauling",
    ]));
    expect(ranked.map((item) => item.keyword)).not.toEqual(expect.arrayContaining([
      "property managers cost",
      "rental property managers near me",
      "commercial real estate property managers",
      "real estate CRM",
      "renovation schedule",
    ]));
  });

  it("rejects geography-only, unrelated-industry, remote-city, and social-proof leakage", () => {
    const junkBrief = {
      source: "deterministic" as const,
      model: null,
      businessSummary: "98 Junk It provides junk removal and cleanout services.",
      offerVsEnablement: {
        whatCompanySells: ["residential and commercial junk removal", "property cleanouts", "furniture and appliance removal", "construction debris hauling", "same day pickup"],
        whatProductEnables: ["reclaim usable space"],
        notTheOffer: [],
      },
      audiences: ["property managers"],
      problems: ["unwanted furniture and debris"],
      differentiators: ["served Fremont for 20 years", "200 five-star reviews"],
      themes: [
        { id: "services", label: "Products and services", funnelRole: "conversion" as const, priority: "primary" as const, seedKeywords: ["residential and commercial junk removal", "property cleanouts", "construction debris hauling"], requiredTerms: ["junk", "property cleanouts", "debris hauling"], negativeTerms: [], evidence: [{ field: "productsServices" as const, quote: "residential and commercial junk removal" }] },
        { id: "furniture", label: "Furniture and appliance removal", funnelRole: "conversion" as const, priority: "primary" as const, seedKeywords: ["furniture removal", "appliance removal"], requiredTerms: ["removal"], negativeTerms: [], evidence: [{ field: "productsServices" as const, quote: "furniture and appliance removal" }] },
        { id: "disposal", label: "Responsible junk disposal", funnelRole: "awareness" as const, priority: "secondary" as const, seedKeywords: ["responsible disposal", "junk disposal"], requiredTerms: ["disposal"], negativeTerms: [], evidence: [{ field: "problemSolved" as const, quote: "responsible disposal" }] },
        { id: "estimates", label: "Free estimates", funnelRole: "technical_authority" as const, priority: "supporting" as const, seedKeywords: ["free junk removal estimates", "free estimates"], requiredTerms: ["free estimates"], negativeTerms: [], evidence: [{ field: "differentiation" as const, quote: "free estimates" }] },
        { id: "proof", label: "Differentiated capabilities", funnelRole: "technical_authority" as const, priority: "primary" as const, seedKeywords: ["served Fremont", "five-star reviews"], requiredTerms: ["served Fremont", "five-star reviews"], negativeTerms: [], evidence: [{ field: "differentiation" as const, quote: "served Fremont for 20 years and earned 200 five-star reviews" }] },
      ],
    };
    const ranked = rankKeywordOpportunities([
      { keyword: "commercial junk removal services", intent: "commercial", searchVolume: 590, opportunity: "site_idea" },
      { keyword: "hotels san francisco bay area", intent: "transactional", searchVolume: 60_500, opportunity: "site_idea" },
      { keyword: "car rental san francisco bay area", intent: "transactional", searchVolume: 18_100, opportunity: "site_idea" },
      { keyword: "apartments for rent san francisco bay area", intent: "transactional", searchVolume: 18_100, opportunity: "site_idea" },
      { keyword: "craigslist sf bay area ca apartments", intent: "commercial", searchVolume: 6_600, opportunity: "site_idea" },
      { keyword: "what services do residential care homes provide", intent: "informational", searchVolume: 10, opportunity: "site_idea" },
      { keyword: "junk removal services baltimore", intent: "commercial", searchVolume: 40, opportunity: "site_idea" },
      { keyword: "mold removal services", intent: "commercial", searchVolume: 110_000, opportunity: "site_idea" },
      { keyword: "auto dent removal services", intent: "commercial", searchVolume: 550_000, opportunity: "site_idea" },
      { keyword: "junk car removal", intent: "transactional", searchVolume: 9_900, opportunity: "site_idea" },
      { keyword: "junk removal leads", intent: "transactional", searchVolume: 390, opportunity: "site_idea" },
      { keyword: "oklahoma city junk removal", intent: "informational", searchVolume: 590, opportunity: "site_idea" },
      { keyword: "athens junk removal", intent: "informational", searchVolume: 320, opportunity: "site_idea" },
      { keyword: "junk removal barrie free", intent: "commercial", searchVolume: 10, opportunity: "site_idea" },
      { keyword: "ottawa junk removal free", intent: "commercial", searchVolume: 10, opportunity: "site_idea" },
      { keyword: "waste removal services", intent: "commercial", searchVolume: 8_100, opportunity: "site_idea" },
      { keyword: "waste management residential services", intent: "commercial", searchVolume: 40_500, opportunity: "site_idea" },
      { keyword: "trash service near me", intent: "transactional", searchVolume: 74_000, opportunity: "competitor_gap" },
      { keyword: "trash services near me", intent: "transactional", searchVolume: 74_000, opportunity: "competitor_gap" },
      { keyword: "trash pickup", intent: "transactional", searchVolume: 22_200, opportunity: "competitor_gap" },
      { keyword: "big bulk trash pickup", intent: "transactional", searchVolume: 14_800, opportunity: "competitor_gap" },
      { keyword: "bulk pickup trash", intent: "transactional", searchVolume: 14_800, opportunity: "competitor_gap" },
      { keyword: "bulky waste pickup", intent: "transactional", searchVolume: 14_800, opportunity: "competitor_gap" },
      { keyword: "large trash pickup", intent: "transactional", searchVolume: 14_800, opportunity: "competitor_gap" },
      { keyword: "waste collection services", intent: "commercial", searchVolume: 27_100, opportunity: "competitor_gap" },
      { keyword: "garbage waste pickup", intent: "commercial", searchVolume: 22_200, opportunity: "competitor_gap" },
      { keyword: "curbside pickup waste management", intent: "commercial", searchVolume: 12_100, opportunity: "competitor_gap" },
      { keyword: "pick up rubbish service", intent: "transactional", searchVolume: 14_800, opportunity: "competitor_gap" },
      { keyword: "trash pickup services", intent: "commercial", searchVolume: 14_800, opportunity: "competitor_gap" },
      { keyword: "rubbish collection service", intent: "commercial", searchVolume: 27_100, opportunity: "competitor_gap" },
      { keyword: "interstate waste services", intent: "commercial", searchVolume: 18_100, opportunity: "site_idea" },
      { keyword: "bay area disposal", intent: "commercial", searchVolume: 210, opportunity: "site_idea" },
      { keyword: "waste management dumpster rental", intent: "transactional", searchVolume: 14_800, opportunity: "site_idea" },
      { keyword: "abc home and commercial services", intent: "commercial", searchVolume: 12_100, opportunity: "site_idea" },
      { keyword: "waste disposal truck", intent: "transactional", searchVolume: 40_500, opportunity: "site_idea" },
      { keyword: "bulk rubbish pickup", intent: "transactional", searchVolume: 14_800, opportunity: "site_idea" },
      { keyword: "construction estimates free", intent: "commercial", searchVolume: 590, opportunity: "site_idea" },
      { keyword: "estimates free", intent: "commercial", searchVolume: 2_900, opportunity: "site_idea" },
      { keyword: "free estimates on plumbing", intent: "commercial", searchVolume: 2_900, opportunity: "site_idea" },
      { keyword: "free estimates plumber", intent: "commercial", searchVolume: 2_900, opportunity: "site_idea" },
      { keyword: "free estimates roofing", intent: "commercial", searchVolume: 1_600, opportunity: "site_idea" },
      { keyword: "free home estimates", intent: "commercial", searchVolume: 5_400, opportunity: "site_idea" },
      { keyword: "estimates templates free", intent: "commercial", searchVolume: 1_900, opportunity: "site_idea" },
      { keyword: "free estimates for hvac", intent: "commercial", searchVolume: 880, opportunity: "site_idea" },
      { keyword: "garbage disposal installation cost", intent: "transactional", searchVolume: 9_900, opportunity: "site_idea" },
      { keyword: "tire disposal near me", intent: "transactional", searchVolume: 18_100, opportunity: "site_idea" },
      { keyword: "garbage disposal replacement", intent: "transactional", searchVolume: 9_900, opportunity: "site_idea" },
      { keyword: "garbage disposal not working", intent: "transactional", searchVolume: 27_100, opportunity: "site_idea" },
      { keyword: "insinkerator garbage disposal", intent: "commercial", searchVolume: 40_500, opportunity: "site_idea" },
      { keyword: "sharps container disposal", intent: "commercial", searchVolume: 18_100, opportunity: "site_idea" },
      { keyword: "continuous feed garbage disposal", intent: "commercial", searchVolume: 12_100, opportunity: "site_idea" },
      { keyword: "cat litter disposal system", intent: "commercial", searchVolume: 12_100, opportunity: "site_idea" },
      { keyword: "waste dump locations near me", intent: "transactional", searchVolume: 301_000, opportunity: "site_idea" },
      { keyword: "same day laundry pickup and delivery near me", intent: "transactional", searchVolume: 110, opportunity: "site_idea" },
      { keyword: "capital waste services", intent: "commercial", searchVolume: 8_100, opportunity: "site_idea" },
      { keyword: "junk out junk removal", intent: "informational", searchVolume: 210, opportunity: "site_idea" },
    ], {
      productsServices: "Residential and commercial junk removal in Fremont and the Bay Area, property cleanouts, furniture and appliance removal, construction debris hauling, and same-day pickup",
      differentiation: "Served Fremont for 20 years with 200 five-star reviews",
      locationEvidence: "Fremont, San Jose, Livermore, Pleasanton, and the San Francisco Bay Area",
    }, 50, junkBrief);

    expect(ranked.map((item) => item.keyword).sort()).toEqual([
      "commercial junk removal services",
      "waste removal services",
    ].sort());
  });

  it("drops the broad informational head term while retaining measured buyer-oriented service phrases", () => {
    const ranked = rankKeywordOpportunities([
      { keyword: "junk removal", intent: "informational", searchVolume: 135_000, opportunity: "competitor_gap", competitorRankers: 2 },
      { keyword: "junk hauling", intent: "commercial", searchVolume: 1_900, opportunity: "site_idea" },
      { keyword: "same day junk removal", intent: "commercial", searchVolume: 320, opportunity: "site_idea" },
      { keyword: "commercial junk removal services", intent: "commercial", searchVolume: 590, opportunity: "site_idea" },
      { keyword: "junk removal cost", intent: "informational", searchVolume: 720, opportunity: "site_idea" },
    ], {
      productsServices: "Residential and commercial junk removal, same-day pickup, and junk hauling",
      idealCustomer: "Homeowners and local businesses in Fremont",
    });

    expect(ranked.map((item) => item.keyword)).toEqual(expect.arrayContaining([
      "junk hauling",
      "same day junk removal",
      "commercial junk removal services",
      "junk removal cost",
    ]));
    expect(ranked.map((item) => item.keyword)).not.toContain("junk removal");
  });

  it("does not let a saved audience theme bypass the service-anchor gate", () => {
    const ranked = rankKeywordOpportunities([{
      keyword: "property managers near me",
      intent: "transactional",
      searchVolume: 40_500,
      opportunity: "site_idea",
      themeId: "audience-use-cases",
      themeLabel: "Audience use cases",
      themeRole: "consideration",
    }], {
      productsServices: "Residential and commercial junk removal, property cleanouts, and construction debris hauling",
      idealCustomer: "Property managers and homeowners in Fremont",
    });

    expect(ranked).toEqual([]);
  });

  it("keeps evidenced local markets and rejects unrelated city modifiers", () => {
    const ranked = rankKeywordOpportunities([
      { keyword: "junk removal services in los angeles", intent: "commercial", searchVolume: 590, opportunity: "site_idea" },
      { keyword: "junk removal services boston", intent: "commercial", searchVolume: 90, opportunity: "site_idea" },
      { keyword: "junk removal services tucson", intent: "commercial", searchVolume: 30, opportunity: "site_idea" },
      { keyword: "junk removal services york pa", intent: "commercial", searchVolume: 30, opportunity: "site_idea" },
      { keyword: "roswell junk removal", intent: "commercial", searchVolume: 90, opportunity: "site_idea" },
      { keyword: "junk removal columbus", intent: "commercial", searchVolume: 90, opportunity: "site_idea" },
      { keyword: "junk removal madison", intent: "commercial", searchVolume: 90, opportunity: "site_idea" },
      { keyword: "fremont junk removal", intent: "commercial", searchVolume: 210, opportunity: "site_idea" },
      { keyword: "junk removal san jose", intent: "commercial", searchVolume: 70, opportunity: "site_idea" },
      { keyword: "junk removal livermore", intent: "commercial", searchVolume: 90, opportunity: "existing_rank", rank: 20 },
    ], {
      productsServices: "Residential and commercial junk removal serving Fremont and the Bay Area",
      idealCustomer: "Homeowners and businesses in Fremont",
      locationEvidence: "Serving Fremont, San Jose, Livermore, Pleasanton, and Redwood City",
    });

    expect(ranked.map((item) => item.keyword)).toEqual(expect.arrayContaining([
      "fremont junk removal",
      "junk removal san jose",
      "junk removal livermore",
    ]));
    expect(ranked.map((item) => item.keyword)).not.toEqual(expect.arrayContaining([
      "junk removal services in los angeles",
      "junk removal services boston",
      "junk removal services tucson",
      "junk removal services york pa",
      "roswell junk removal",
      "junk removal columbus",
      "junk removal madison",
    ]));
  });

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

  it("can retain a broad three-month approval pool without padding it with noise", () => {
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

  it("does not truncate a valid single-theme local-service pool to eleven keywords", () => {
    const ranked = Array.from({ length: 35 }, (_, index) => ({
      keyword: `measured junk removal service segment${index + 1}`,
      searchVolume: 100 + index,
      priorityTier: 1 as const,
      priorityScore: 90 - (index % 10),
      businessFit: 1,
      revenueFit: 0.9,
      relevanceTier: "core" as const,
      providerIntent: "commercial" as const,
      searchIntent: "consideration" as const,
      priorityReason: "Measured service opportunity",
      themeId: "products-and-services",
      themeLabel: "Products and services",
      themeRole: "conversion" as const,
    }));

    expect(selectDiversifiedKeywordOpportunities(ranked, 35)).toHaveLength(35);
  });
});
