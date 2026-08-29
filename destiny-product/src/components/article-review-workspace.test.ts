import { describe, expect, it } from "vitest";
import { buildArticleDraft } from "../lib/content/article-draft";
import { normalizeSavedArticleDraft } from "../lib/content/saved-draft-hydration";

const fallback = buildArticleDraft({
  keyword: "content strategy",
  businessName: "Rebound SEO",
  problemSolved: "Content work lacks a reliable operating system.",
  idealCustomer: "Founder-led businesses",
  differentiation: "A guided SEO operating system",
});

describe("normalizeSavedDraft", () => {
  it("demotes an incomplete legacy generated draft to its saved brief", () => {
    const result = normalizeSavedArticleDraft({
      ...fallback,
      generatedBy: "claude",
      body: "word ".repeat(392),
      generationStatus: "generated",
      qualityIssues: [],
      preferences: { ...fallback.preferences, specialInstructions: "Keep the brief" },
    }, fallback);

    expect(result.generationStatus).toBe("starter");
    expect(result.body).toBe(fallback.body);
    expect(result.preferences.specialInstructions).toBe("Keep the brief");
    expect(result.approved).toBe(false);
  });

  it("keeps a complete, quality-passing generated article available for review", () => {
    const result = normalizeSavedArticleDraft({
      ...fallback,
      generatedBy: "claude",
      body: "word ".repeat(1800),
      generationStatus: "generated",
      qualityIssues: [],
    }, fallback);

    expect(result.generationStatus).toBe("generated");
    expect(result.body.split(/\s+/).filter(Boolean)).toHaveLength(1800);
  });
});
