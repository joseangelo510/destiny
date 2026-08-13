import { describe, expect, it } from "vitest";
import {
  articleContinuationDecision,
  articleHasCleanEnding,
  buildAnthropicArticleContinuationRequest,
  buildArticleContinuationPrompt,
  mergeArticleContinuation,
  parseArticleContinuation,
} from "./article-recovery";

function words(count: number) {
  return Array.from({ length: count }, (_, index) => `word${index}`).join(" ");
}

describe("bounded article recovery", () => {
  it("requests one continuation for the observed short, mid-sentence SEO failure", () => {
    const body = `# Junk Removal Guide\n\n## What to Know\n\n${words(392)} and this stops without finishing`;

    expect(articleHasCleanEnding(body)).toBe(false);
    expect(articleContinuationDecision(body, "seo_article", "end_turn")).toEqual({
      needed: true,
      reason: "short_and_unclean",
      wordCount: 403,
      cleanEnding: false,
    });
  });

  it("does not spend a second model call on a complete long-form article", () => {
    const body = `# Complete Guide\n\n## Final section\n\n${words(2_050)} This is the final recommendation.`;

    expect(articleContinuationDecision(body, "seo_article", "end_turn")).toMatchObject({
      needed: false,
      reason: null,
      cleanEnding: true,
    });
  });

  it("treats max_tokens as incomplete even when the text ends with punctuation", () => {
    const body = `# Guide\n\n${words(2_050)} This sentence looks complete.`;
    expect(articleContinuationDecision(body, "seo_article", "max_tokens").reason).toBe("max_tokens");
  });

  it("builds a continuation-only request without a structured JSON envelope", () => {
    const prompt = buildArticleContinuationPrompt({
      bodyMarkdown: "# Guide\n\nA short draft.",
      researchEvidence: "1. Government source — https://example.gov/research",
      targetMinimumWords: 2_000,
      targetMaximumWords: 3_000,
    });
    const request = buildAnthropicArticleContinuationRequest(prompt, "claude-opus-4-8");

    expect(prompt).toContain("2,000–3,000 total words");
    expect(prompt).toContain("Do not repeat the H1");
    expect(prompt).toContain("https://example.gov/research");
    expect(request).toMatchObject({ model: "claude-opus-4-8", max_tokens: 7_000 });
    expect(request).not.toHaveProperty("output_config");
    expect(request.messages).toEqual([{ role: "user", content: prompt }]);
  });

  it("preserves the Logos 6–9 H2 policy during a finishing pass", () => {
    const prompt = buildArticleContinuationPrompt({
      bodyMarkdown: [
        "# Existing guide",
        "",
        "## One", "Text.",
        "## Two", "Text.",
        "## Three", "Text.",
        "## Four", "Text.",
        "## Five", "Text.",
        "## Six", "Text.",
        "## Seven", "Text.",
        "## Eight", "Text.",
      ].join("\n"),
      researchEvidence: "",
      targetMinimumWords: 2_000,
      targetMaximumWords: 3_000,
    });

    expect(prompt).toContain("already contains 8 H2 sections");
    expect(prompt).toContain("Add at most 1 new H2 section");
    expect(prompt).toContain("Use H3 subsections or paragraphs");
  });

  it("removes an unfinished tail and repeated overlap before joining the continuation", () => {
    const original = "# Guide\n\n## Existing section\n\nA complete sentence. This unfinished thought";
    const continuation = "A complete sentence.\n\n## Next section\n\nThis is the finished article.";
    const merged = mergeArticleContinuation(original, continuation);

    expect(merged).toContain("A complete sentence.\n\n## Next section");
    expect(merged.match(/A complete sentence\./g)).toHaveLength(1);
    expect(merged).not.toContain("unfinished thought");
    expect(merged).not.toContain("# Guide\n\n# Guide");
  });

  it("drops a bounded trailing window when a long interrupted paragraph has no punctuation", () => {
    const original = `# Guide\n\n## Existing section\n\n${words(392)} this unfinished thought`;
    const merged = mergeArticleContinuation(original, "## Next section\n\nThis is the finished article.");

    expect(merged).not.toContain("unfinished thought");
    expect(merged).toContain("word300");
    expect(merged).toContain("## Next section");
  });

  it("strips wrappers but rejects an empty or still-structured continuation", () => {
    expect(parseArticleContinuation("```markdown\n## Finish\n\nA clean ending.\n```")).toBe("## Finish\n\nA clean ending.");
    expect(() => parseArticleContinuation("```markdown\n\n```")).toThrow("empty continuation");
    expect(() => parseArticleContinuation('{"bodyMarkdown":"not plain markdown"}')).toThrow("plain Markdown");
  });
});
