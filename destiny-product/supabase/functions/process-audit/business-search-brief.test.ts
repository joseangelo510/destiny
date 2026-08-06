import { describe, expect, it, vi } from "vitest";
import {
  buyerExpansionSeeds,
  createBusinessSearchBrief,
  deterministicBusinessSearchBrief,
  type BusinessSearchContext,
} from "./business-search-brief";

const LOGICAFFEINE_CONTEXT: BusinessSearchContext = {
  businessName: "DatacenterDotDev Inc",
  productsServices: "We build software and firmware for datacenters. Our core product is a general purpose programming language called Logos that is the fastest in the world. It is based on English syntax to make programming accessible to anyone that knows English.",
  problemSolved: "Datacenter power constraints, processing speeds, code is unreadable by anyone that doesn't know the specific coding language.",
  idealCustomer: "data center developers, software developers, vibe coders",
  audienceChallengesGoals: "we want our audience to be able to program just like all of the other programmers in the world and not have to learn totally new language a bunch of different syntax and symbols we want them to be able to use English. We also want to exponentially reduce power consumption of datacenter high-performance compute processing.",
  differentiation: "Our programming language has a built in SAT solver and super compiler. We can transpile logos hardware specifications and then transpile them into System Verilog Assertions for computer chip architecture design that is provably bug free.",
  market: "United States",
};

const JUNK_REMOVAL_CONTEXT: BusinessSearchContext = {
  businessName: "98 Junk It",
  productsServices: "We provide residential and commercial junk removal in Fremont and the San Francisco Bay Area, including property cleanouts, furniture and appliance removal, construction debris hauling, and same-day pickup.",
  problemSolved: "Customers need a fast, reliable way to remove unwanted furniture, appliances, debris, and clutter without renting a truck.",
  idealCustomer: "Homeowners, renters, property managers, real estate professionals, contractors, and local business owners in Fremont and the Bay Area.",
  audienceChallengesGoals: "Help customers reclaim usable space, finish moves, and prepare properties for sale or rent.",
  differentiation: "We have served Fremont for 20 years and earned more than 200 five-star reviews.",
  market: "United States",
};

const CLAUDE_BRIEF = {
  businessSummary: "Logos is a high-performance English-syntax programming language for datacenter, software, and hardware developers.",
  offerVsEnablement: {
    whatCompanySells: ["Logos general purpose programming language", "datacenter software and firmware"],
    whatProductEnables: ["software development", "provably bug-free computer chip architecture"],
    notTheOffer: ["project management software", "generic app builder", "CRM software", "house or deck design software"],
  },
  audiences: ["datacenter developers", "software developers", "vibe coders", "computer chip architects"],
  problems: ["datacenter power consumption", "slow high-performance compute processing", "unreadable programming syntax", "hardware verification bugs"],
  differentiators: ["English syntax", "SAT solver", "super compiler", "SystemVerilog Assertions", "provably bug-free chip architecture"],
  themes: [
    {
      id: "programming-language",
      label: "Programming language adoption",
      funnelRole: "consideration",
      priority: "primary",
      seedKeywords: ["general purpose programming language", "programming language for software developers"],
      requiredTerms: ["programming language", "logos"],
      negativeTerms: ["project management", "house", "deck", "bridge"],
      evidence: [{ field: "productsServices", quote: "general purpose programming language" }],
    },
    {
      id: "datacenter-efficiency",
      label: "Datacenter compute efficiency",
      funnelRole: "awareness",
      priority: "primary",
      seedKeywords: ["reduce datacenter power consumption", "high performance compute programming language"],
      requiredTerms: ["datacenter", "high performance compute"],
      negativeTerms: ["residential"],
      evidence: [
        { field: "problemSolved", quote: "Datacenter power constraints" },
        { field: "audienceChallengesGoals", quote: "reduce power consumption of datacenter high-performance compute processing" },
      ],
    },
    {
      id: "english-syntax",
      label: "Accessible English-syntax programming",
      funnelRole: "awareness",
      priority: "supporting",
      seedKeywords: ["English syntax programming language", "easy programming language for vibe coders"],
      requiredTerms: ["English syntax", "vibe coders"],
      negativeTerms: [],
      evidence: [
        { field: "productsServices", quote: "English syntax" },
        { field: "idealCustomer", quote: "vibe coders" },
      ],
    },
    {
      id: "compiler-performance",
      label: "Compiler and language performance",
      funnelRole: "consideration",
      priority: "primary",
      seedKeywords: ["fastest programming language", "super compiler performance"],
      requiredTerms: ["programming language", "super compiler"],
      negativeTerms: [],
      evidence: [{ field: "differentiation", quote: "super compiler" }],
    },
    {
      id: "hardware-verification",
      label: "Hardware verification and chip design",
      funnelRole: "technical_authority",
      priority: "primary",
      seedKeywords: ["SystemVerilog Assertions generator", "SAT solver hardware verification", "provably bug free chip design"],
      requiredTerms: ["SystemVerilog Assertions", "SAT solver", "chip design"],
      negativeTerms: [],
      evidence: [{ field: "differentiation", quote: "System Verilog Assertions" }],
    },
  ],
};

describe("business search brief", () => {
  it("asks Opus 4.8 to synthesize every onboarding answer with structured output", async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => Response.json({
      id: "msg_test",
      stop_reason: "end_turn",
      content: [{ type: "text", text: JSON.stringify(CLAUDE_BRIEF) }],
    }));

    const brief = await createBusinessSearchBrief(
      LOGICAFFEINE_CONTEXT,
      [{ name: "Rust", url: "https://www.rust-lang.org" }],
      { apiKey: "test-key", model: "claude-opus-4-8" },
      fetchMock,
    );

    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;
    const requestText = JSON.stringify(request);
    expect(request).toMatchObject({
      model: "claude-opus-4-8",
      thinking: { type: "adaptive" },
      output_config: { effort: "high", format: { type: "json_schema" } },
    });
    expect(request).not.toHaveProperty("temperature");
    expect(request).not.toHaveProperty("top_p");
    expect(requestText).toContain(LOGICAFFEINE_CONTEXT.productsServices);
    expect(requestText).toContain(LOGICAFFEINE_CONTEXT.problemSolved);
    expect(requestText).toContain(LOGICAFFEINE_CONTEXT.idealCustomer);
    expect(requestText).toContain(LOGICAFFEINE_CONTEXT.audienceChallengesGoals);
    expect(requestText).toContain(LOGICAFFEINE_CONTEXT.differentiation);
    expect(requestText).toContain("Rust");
    expect(requestText).toContain("4-8 distinct discovery seeds");
    expect(requestText).not.toContain('"minItems":4');
    expect(requestText).not.toContain('"maxItems":8');
    expect(brief).toMatchObject({ source: "claude-opus-4-8", model: "claude-opus-4-8" });
    expect(brief.themes.map((theme) => theme.id)).toEqual(expect.arrayContaining([
      "programming-language",
      "datacenter-efficiency",
      "english-syntax",
      "compiler-performance",
      "hardware-verification",
    ]));
    expect(brief.offerVsEnablement.notTheOffer).toContain("project management software");
  });

  it("falls back to field-balanced evidence instead of one short products phrase", () => {
    const brief = deterministicBusinessSearchBrief(LOGICAFFEINE_CONTEXT);
    const seedText = brief.themes.flatMap((theme) => theme.seedKeywords).join(" | ").toLowerCase();
    const evidenceFields = new Set(brief.themes.flatMap((theme) => theme.evidence.map((item) => item.field)));

    expect(brief.source).toBe("deterministic");
    expect(brief.themes.length).toBeGreaterThanOrEqual(4);
    expect(seedText).toContain("programming language");
    expect(seedText).toMatch(/datacenter|data center/);
    expect(seedText).toMatch(/system verilog|sat solver|chip architecture/);
    expect(evidenceFields.has("productsServices")).toBe(true);
    expect(evidenceFields.has("problemSolved") || evidenceFields.has("audienceChallengesGoals")).toBe(true);
    expect(evidenceFields.has("differentiation")).toBe(true);
    expect(brief.themes.flatMap((theme) => theme.seedKeywords)).not.toContain("build software");
  });

  it("keeps the Opus brief and supplements omitted onboarding fields conservatively", async () => {
    const partialBrief = {
      ...CLAUDE_BRIEF,
      themes: CLAUDE_BRIEF.themes.map((theme) => ({
        ...theme,
        evidence: theme.evidence.filter((item) =>
          item.field !== "differentiation" && item.field !== "audienceChallengesGoals"),
      })).filter((theme) => theme.evidence.length),
    };
    const fetchMock = vi.fn(async () => Response.json({
      id: "msg_partial",
      stop_reason: "end_turn",
      content: [{ type: "text", text: JSON.stringify(partialBrief) }],
    }));

    const brief = await createBusinessSearchBrief(
      LOGICAFFEINE_CONTEXT,
      [],
      { apiKey: "test-key", model: "claude-opus-4-8" },
      fetchMock,
    );

    const coveredFields = new Set(brief.themes.flatMap((theme) => theme.evidence.map((item) => item.field)));
    expect(brief.source).toBe("claude-opus-4-8");
    expect(brief.warning).toMatch(/supplemented/i);
    expect(coveredFields.has("audienceChallengesGoals")).toBe(true);
    expect(coveredFields.has("differentiation")).toBe(true);
  });

  it("uses the deterministic brief when the API is unavailable", async () => {
    const brief = await createBusinessSearchBrief(
      LOGICAFFEINE_CONTEXT,
      [],
      { apiKey: "test-key", model: "claude-opus-4-8" },
      vi.fn(async () => new Response("unavailable", { status: 503 })),
    );

    expect(brief.source).toBe("deterministic");
    expect(brief.warning).toMatch(/Opus 4\.8/i);
  });

  it("separates services from geography, audiences, outcomes, and proof in the deterministic fallback", () => {
    const brief = deterministicBusinessSearchBrief(JUNK_REMOVAL_CONTEXT);
    const offers = brief.offerVsEnablement.whatCompanySells.map((value) => value.toLowerCase());
    const productThemeSeeds = brief.themes
      .filter((theme) => theme.evidence.some((item) => item.field === "productsServices"))
      .flatMap((theme) => theme.seedKeywords.map((value) => value.toLowerCase()));

    expect(offers).toEqual(expect.arrayContaining([
      "residential and commercial junk removal",
      "property cleanouts",
      "furniture and appliance removal",
      "construction debris hauling",
      "same day pickup",
    ]));
    expect([...offers, ...productThemeSeeds].join(" | ")).not.toMatch(/san francisco bay area|served fremont|five.star reviews|property managers|finish moves|united states/i);
  });

  it("builds buyer expansion seeds from offers and offer-plus-audience combinations only", () => {
    const brief = {
      source: "deterministic" as const,
      model: null,
      businessSummary: "98 Junk It removes junk in Fremont.",
      offerVsEnablement: {
        whatCompanySells: ["commercial junk removal services", "construction debris hauling"],
        whatProductEnables: ["finish moves", "reclaim space"],
        notTheOffer: [],
      },
      audiences: ["property managers", "real estate professionals"],
      problems: ["customers need fast removal"],
      differentiators: ["200 five-star reviews"],
      themes: [
        { id: "offer", label: "Junk removal", funnelRole: "conversion" as const, priority: "primary" as const, seedKeywords: ["commercial junk removal services", "property cleanouts"], requiredTerms: ["junk removal"], negativeTerms: [], evidence: [{ field: "productsServices" as const, quote: "commercial junk removal services" }] },
        { id: "debris", label: "Debris and appliance removal", funnelRole: "conversion" as const, priority: "primary" as const, seedKeywords: ["construction debris hauling", "appliance removal"], requiredTerms: ["debris hauling", "appliance removal"], negativeTerms: [], evidence: [{ field: "productsServices" as const, quote: "construction debris hauling" }] },
        { id: "audience", label: "Audience", funnelRole: "consideration" as const, priority: "secondary" as const, seedKeywords: ["property managers", "real estate professionals"], requiredTerms: ["property managers"], negativeTerms: [], evidence: [{ field: "idealCustomer" as const, quote: "property managers" }] },
        { id: "proof", label: "Proof", funnelRole: "technical_authority" as const, priority: "supporting" as const, seedKeywords: ["200 five-star reviews"], requiredTerms: ["five-star reviews"], negativeTerms: [], evidence: [{ field: "differentiation" as const, quote: "200 five-star reviews" }] },
      ],
    };

    const seeds = buyerExpansionSeeds(brief, 8);

    expect(seeds).toEqual(expect.arrayContaining([
      "commercial junk removal services",
      "construction debris hauling",
      "commercial junk removal services for property managers",
    ]));
    expect(seeds.indexOf("construction debris hauling")).toBeLessThan(seeds.indexOf("property cleanouts"));
    expect(seeds.slice(0, 2)).toEqual([
      "commercial junk removal services",
      "construction debris hauling",
    ]);
    expect(seeds.join(" | ")).not.toMatch(/finish moves|five-star reviews|customers need fast/i);
    expect(seeds).not.toContain("property managers");
  });
});
