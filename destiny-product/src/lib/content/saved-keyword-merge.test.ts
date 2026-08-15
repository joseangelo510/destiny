import { describe, expect, it } from "vitest";
import { keywordEvidenceFromResearch, mergeSavedApprovedKeywords } from "./saved-keyword-merge";

const auditKeywords = [
  { keyword: "college admissions consultant", searchVolume: 720, difficulty: 32 },
  { keyword: "Application Essay Help", searchVolume: 300, difficulty: 21 },
];

describe("mergeSavedApprovedKeywords", () => {
  it("includes approved saved keywords that were not in the audit recommendation pool with preserved research evidence", () => {
    const merged = mergeSavedApprovedKeywords(auditKeywords, [{
      keyword: "ivy league admissions coach",
      normalized_keyword: "ivy league admissions coach",
      decision: "approved",
      provider_intent: "commercial",
      search_volume: 480,
      difficulty: 27,
    }]);
    expect(merged).toHaveLength(3);
    const saved = merged.at(-1);
    expect(saved).toMatchObject({
      keyword: "ivy league admissions coach",
      providerIntent: "commercial",
      intent: "commercial",
      searchVolume: 480,
      difficulty: 27,
      opportunity: "site_idea",
      savedFromResearch: true,
    });
  });

  it("deduplicates against audit keywords by normalized phrase", () => {
    const merged = mergeSavedApprovedKeywords(auditKeywords, [{
      keyword: "application   essay HELP",
      normalized_keyword: "application essay help",
      decision: "approved",
      provider_intent: "informational",
      search_volume: 300,
      difficulty: 21,
    }]);
    expect(merged).toHaveLength(2);
    expect(merged.map((item) => item.keyword)).toEqual(auditKeywords.map((item) => item.keyword));
  });

  it("excludes declined preferences", () => {
    const merged = mergeSavedApprovedKeywords(auditKeywords, [{
      keyword: "cheap essay writing",
      normalized_keyword: "cheap essay writing",
      decision: "declined",
      provider_intent: "transactional",
      search_volume: 900,
      difficulty: 15,
    }]);
    expect(merged).toHaveLength(2);
  });

  it("excludes saved phrases without positive monthly search volume", () => {
    const merged = mergeSavedApprovedKeywords(auditKeywords, [
      { keyword: "zero demand phrase", normalized_keyword: "zero demand phrase", decision: "approved", provider_intent: "informational", search_volume: 0, difficulty: 10 },
      { keyword: "missing volume phrase", normalized_keyword: "missing volume phrase", decision: "approved", provider_intent: "informational", search_volume: null, difficulty: 10 },
    ]);
    expect(merged).toHaveLength(2);
  });

  it("falls back to informational intent when the saved provider intent is missing or invalid", () => {
    const merged = mergeSavedApprovedKeywords([], [{
      keyword: "essay brainstorming ideas",
      normalized_keyword: "essay brainstorming ideas",
      decision: "approved",
      provider_intent: "unknown",
      search_volume: 50,
      difficulty: null,
    }]);
    expect(merged).toEqual([expect.objectContaining({ providerIntent: "informational", difficulty: 0, searchVolume: 50 })]);
  });

  it("deduplicates repeated saved preferences against each other", () => {
    const merged = mergeSavedApprovedKeywords([], [
      { keyword: "test prep coach", normalized_keyword: "test prep coach", decision: "approved", provider_intent: "commercial", search_volume: 100, difficulty: 20 },
      { keyword: "Test Prep Coach", normalized_keyword: "test prep coach", decision: "approved", provider_intent: "commercial", search_volume: 100, difficulty: 20 },
    ]);
    expect(merged).toHaveLength(1);
  });
});

describe("keywordEvidenceFromResearch", () => {
  it("preserves provider intent, monthly search volume, and difficulty from a live research row", () => {
    expect(keywordEvidenceFromResearch({ providerIntent: "Commercial", searchVolume: 480.4, difficulty: 27.6 }))
      .toEqual({ providerIntent: "commercial", searchVolume: 480, difficulty: 28 });
  });

  it("drops invalid values instead of guessing", () => {
    expect(keywordEvidenceFromResearch({ providerIntent: "unknown", searchVolume: -5, difficulty: 250 })).toBeNull();
    expect(keywordEvidenceFromResearch(null)).toBeNull();
    expect(keywordEvidenceFromResearch("evidence")).toBeNull();
    expect(keywordEvidenceFromResearch({ providerIntent: "unknown", searchVolume: 120, difficulty: 250 }))
      .toEqual({ providerIntent: null, searchVolume: 120, difficulty: null });
  });

  it("accepts zero search volume so the preference records the real research reading", () => {
    expect(keywordEvidenceFromResearch({ providerIntent: "informational", searchVolume: 0, difficulty: 12 }))
      .toEqual({ providerIntent: "informational", searchVolume: 0, difficulty: 12 });
  });
});
