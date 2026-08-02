import { describe, expect, it, vi } from "vitest";
import {
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
});
