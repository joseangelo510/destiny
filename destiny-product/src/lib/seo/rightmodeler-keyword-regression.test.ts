import { describe, expect, it } from "vitest";
import { rankKeywordOpportunities } from "./keyword-opportunity";
import { buyerExpansionSeeds, keywordDiscoveryThemes } from "../../../supabase/functions/process-audit/business-search-brief";
import { MIN_RECOMMENDED_KEYWORDS, needsKeywordExpansion, thinKeywordExpansionSeeds } from "../../../supabase/functions/process-audit/seo";

const RIGHTMODELER_CONTEXT = {
  productsServices: "We measure cheaper models against what you shipped and help you optimize costs",
  problemSolved: "Reducing costs and optimizing speed in custom multiagent SaaS products",
  idealCustomer: "Companies building custom AI agents; B2B2C",
  audienceChallengesGoals: "Optimizing their LLM bill for their SaaS product",
  differentiation: "An autonomous optimization layer that takes action instead of only providing observability",
  market: "United States",
};

const RIGHTMODELER_BRIEF = {
  source: "claude-opus-4-8" as const,
  model: "claude-opus-4-8",
  businessSummary: "RightModeler sells an LLM cost and speed optimization platform for custom AI agents.",
  offerVsEnablement: {
    whatCompanySells: ["LLM cost optimization platform", "Autonomous cost and speed optimization for LLM applications"],
    whatProductEnables: ["Reducing LLM costs", "Optimizing AI agent speed"],
    notTheOffer: ["LLM observability", "LLM tracing", "LLM monitoring"],
  },
  audiences: ["Companies building custom AI agents", "B2B2C SaaS engineering teams"],
  problems: ["High LLM spend", "Slow multiagent responses"],
  differentiators: ["Autonomous optimization", "Benchmarks cheaper models against shipped output"],
  themes: [
    {
      id: "llm-cost-optimization",
      label: "LLM cost optimization platform",
      funnelRole: "conversion" as const,
      priority: "primary" as const,
      seedKeywords: ["llm cost optimization", "reduce llm costs", "optimize llm spend", "llm bill optimization"],
      requiredTerms: ["llm"],
      negativeTerms: ["observability", "monitoring", "tracing"],
      evidence: [{ field: "productsServices" as const, quote: "optimize costs" }],
    },
    {
      id: "autonomous-optimization-layer",
      label: "Autonomous optimization layer vs observability",
      funnelRole: "technical_authority" as const,
      priority: "primary" as const,
      seedKeywords: ["autonomous llm optimization", "llm optimization vs observability"],
      requiredTerms: ["llm"],
      negativeTerms: ["monitoring only", "logging"],
      evidence: [{ field: "differentiation" as const, quote: "autonomous optimization layer" }],
    },
    {
      id: "llm-speed",
      label: "AI agent speed optimization",
      funnelRole: "consideration" as const,
      priority: "secondary" as const,
      seedKeywords: ["llm latency optimization", "llm inference speed optimization", "speed up ai agents"],
      requiredTerms: ["llm"],
      negativeTerms: ["internet speed"],
      evidence: [{ field: "problemSolved" as const, quote: "optimizing speed" }],
    },
    {
      id: "audience-use-cases",
      label: "Audience use cases",
      funnelRole: "consideration" as const,
      priority: "secondary" as const,
      seedKeywords: ["companies building custom agents"],
      requiredTerms: ["companies building custom agents"],
      negativeTerms: [],
      evidence: [{ field: "idealCustomer" as const, quote: "Companies building custom AI agents" }],
    },
  ],
};

describe("RightModeler niche SaaS keyword regression", () => {
  it("expands every pool below the 25-keyword product requirement", () => {
    expect(MIN_RECOMMENDED_KEYWORDS).toBe(25);
    expect(needsKeywordExpansion(6)).toBe(true);
    expect(needsKeywordExpansion(24)).toBe(true);
    expect(needsKeywordExpansion(25)).toBe(false);
  });

  it("keeps a useful positive-demand pool without admitting the non-offer category", () => {
    const candidates = [
      ["llm cost optimization", 30, "transactional"],
      ["ai cost optimization", 170, "commercial"],
      ["reduce llm costs", 90, "transactional"],
      ["llm inference cost", 110, "commercial"],
      ["autonomous llm optimization", 140, "commercial"],
      ["llm optimization platform", 260, "commercial"],
      ["llm optimization tools", 70, "commercial"],
      ["llm latency optimization", 210, "commercial"],
      ["llm inference speed optimization", 90, "commercial"],
      ["speed up ai agents", 50, "informational"],
      ["llm inference speed of light", 10, "informational"],
      ["llm observability", 1_300, "commercial"],
      ["llm monitoring tools", 2_400, "commercial"],
      ["llm observability tools", 210, "informational"],
      ["product cost formula", 210, "transactional"],
      ["llm degree cost", 170, "transactional"],
      ["llm harvard cost", 40, "transactional"],
      ["llm cost in canada", 10, "transactional"],
      ["llm optimization agency", 30, "commercial"],
      ["llm search optimization", 140, "commercial"],
      ["llm optimization seo", 40, "commercial"],
      ["llm content optimization", 20, "commercial"],
      ["sample efficient llm optimization with reset replay", 10, "commercial"],
      ["llm training cost calculator", 10, "transactional"],
      ["llm fine-tuning cost calculator", 10, "transactional"],
      ["llm engine optimization", 20, "commercial"],
    ].map(([keyword, searchVolume, intent]) => ({
      keyword: String(keyword),
      searchVolume: Number(searchVolume),
      intent: String(intent),
      difficulty: 35,
      cpc: 8,
      opportunity: "site_idea",
    }));

    const ranked = rankKeywordOpportunities(candidates, RIGHTMODELER_CONTEXT, 35, RIGHTMODELER_BRIEF);

    expect(ranked).toHaveLength(9);
    expect(ranked.every((keyword) => Number(keyword.searchVolume) > 0)).toBe(true);
    expect(ranked.map((keyword) => keyword.keyword)).not.toEqual(expect.arrayContaining([
      "llm observability",
      "llm monitoring tools",
      "llm inference speed of light",
      "llm observability tools",
      "product cost formula",
      "llm degree cost",
      "llm harvard cost",
      "llm cost in canada",
      "llm optimization agency",
      "llm search optimization",
      "llm optimization seo",
      "llm content optimization",
      "sample efficient llm optimization with reset replay",
      "llm training cost calculator",
      "llm fine-tuning cost calculator",
      "llm engine optimization",
    ]));
  });

  it("expands every offer-grounded niche theme instead of only the literal products field", () => {
    const discoveryThemes = keywordDiscoveryThemes(RIGHTMODELER_BRIEF);
    const seeds = buyerExpansionSeeds(RIGHTMODELER_BRIEF, 10);

    expect(discoveryThemes.map((theme) => theme.id)).toEqual([
      "llm-cost-optimization",
      "autonomous-optimization-layer",
      "llm-speed",
    ]);
    expect(seeds).toEqual(expect.arrayContaining([
      "llm cost optimization",
      "autonomous llm optimization",
      "llm latency optimization",
    ]));
    expect(seeds).not.toContain("Companies building custom AI agents");
  });

  it("uses measured survivors first for a single thin-market expansion without duplicate seeds", () => {
    const seeds = thinKeywordExpansionSeeds(
      [{ keyword: "llm cost optimization" }, { keyword: "LLM cost optimization" }].map((keyword) => ({
        ...keyword,
        rank: 0,
        searchVolume: 30,
        url: "",
        intent: "transactional",
        difficulty: 30,
        cpc: 14,
        opportunity: "site_idea" as const,
      })),
      ["llm cost optimization", "autonomous llm optimization"],
      ["llm latency optimization", "speed up ai agents"],
      6,
    );

    expect(seeds).toEqual([
      "llm cost optimization",
      "llm model cost comparison",
      "llm api cost comparison",
      "llm cost comparison",
      "llm token cost",
      "llm inference cost",
    ]);
  });
});
