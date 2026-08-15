import { describe, expect, it } from "vitest";
import {
  SEO_ARTICLE_RECOVERY_MAX_WORDS,
  SEO_ARTICLE_RECOVERY_MIN_WORDS,
  articleContinuationDecision,
  clampContinuationHeadings,
  countH2Sections,
  isContinuationRefusal,
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

  it("regression: an 11-H2 draft near 1,994 words gets a zero-H2 budget and a buffered word target", () => {
    // Live failure: "background screening services" refreshed to ~1,994–2,025
    // words with 11 H2 sections and failed closed with incomplete_output.
    const sectionText = words(181); // 11 sections × ~181 words ≈ 1,994 words
    const body = `# Background screening services\n\n${Array.from({ length: 11 }, (_, index) => `## Section ${index + 1}\n\n${sectionText}.`).join("\n\n")}`;
    expect(countH2Sections(body)).toBe(11);

    const prompt = buildArticleContinuationPrompt({
      bodyMarkdown: body,
      researchEvidence: "",
      targetMinimumWords: SEO_ARTICLE_RECOVERY_MIN_WORDS,
      targetMaximumWords: SEO_ARTICLE_RECOVERY_MAX_WORDS,
    });
    expect(prompt).toContain("already contains 11 H2 sections");
    expect(prompt).toContain("Do not add another H2 section");
    // The buffered band keeps the finishing pass away from the bare 2,000 floor.
    expect(prompt).toContain("2,200–2,900 total words");

    // Even if the model ignores the rule, the merge demotes every new H2.
    const continuation = "The final answer arrives here.\n\n## Extra section one\n\nMore useful coverage ends cleanly.\n\n## Extra section two\n\nCoverage that also ends cleanly.";
    const merged = mergeArticleContinuation(body, continuation);
    expect(countH2Sections(merged)).toBe(11);
    expect(merged).toContain("### Extra section one");
    expect(merged).toContain("### Extra section two");
  });

  it("regression: a 10-H2 draft near 2,058 words cannot gain another H2 from a finishing pass", () => {
    // Live failure: "volunteer background check service" produced ~2,058 words
    // with 10 H2 sections and failed the 6–9 heading policy.
    const sectionText = words(204); // 10 sections × ~204 words ≈ 2,058 words
    const body = `# Volunteer background check service\n\n${Array.from({ length: 10 }, (_, index) => `## Section ${index + 1}\n\n${sectionText}.`).join("\n\n")}`;
    expect(countH2Sections(body)).toBe(10);

    const merged = mergeArticleContinuation(body, "A closing summary sentence.\n\n## Frequently asked questions\n\nAnswers end with complete sentences.");
    expect(countH2Sections(merged)).toBe(10);
    expect(merged).toContain("### Frequently asked questions");
  });

  it("allows continuation H2s up to the remaining budget and demotes only the excess", () => {
    const body = `# Guide\n\n${Array.from({ length: 8 }, (_, index) => `## Section ${index + 1}\n\nText.`).join("\n\n")}`;
    const continuation = "Bridge sentence.\n\n## Ninth section\n\nFits the budget.\n\n## Tenth section\n\nExceeds the budget.";
    const merged = mergeArticleContinuation(body, continuation);

    expect(countH2Sections(merged)).toBe(9);
    expect(merged).toContain("## Ninth section");
    expect(merged).toContain("### Tenth section");
  });

  it("ignores '##' inside fenced and indented code when counting or clamping H2s", () => {
    const codeHeavy = [
      "# Guide",
      "",
      "## Real section",
      "",
      "```bash",
      "## this is a shell comment, not a heading",
      "```",
      "",
      "    ## four-space-indented code, not a heading",
      "",
      "   ## three-space-indented real heading",
    ].join("\n");
    expect(countH2Sections(codeHeavy)).toBe(2);

    // A pseudo-closing fence (text after the run) must not end the block,
    // for both fence characters.
    const pseudoClose = [
      "## Real heading",
      "```bash",
      "```not-a-close",
      "## still inside the backtick fence",
      "```",
      "~~~",
      "~~~not-a-close",
      "## still inside the tilde fence",
      "~~~",
    ].join("\n");
    expect(countH2Sections(pseudoClose)).toBe(1);

    const full = `# T\n\n${Array.from({ length: 9 }, (_, index) => `## S${index + 1}\n\nText.`).join("\n\n")}`;
    const continuation = [
      "Closing prose.",
      "",
      "```",
      "## stays untouched inside the fence",
      "```",
      "",
      "  ## real excess heading",
    ].join("\n");
    const clamped = clampContinuationHeadings(full, continuation);
    expect(clamped).toContain("## stays untouched inside the fence");
    expect(clamped).not.toContain("### stays untouched");
    expect(clamped).toContain("  ### real excess heading");
  });

  it("bounds a near-ceiling finishing pass with a small new-word allowance", () => {
    // A ~2,850-word unclean draft must only be finished, never expanded past
    // the 3,000-word policy ceiling.
    const body = `# Guide\n\n## Only section\n\n${words(2_800)} and this trails off`;
    const prompt = buildArticleContinuationPrompt({
      bodyMarkdown: body,
      researchEvidence: "",
      targetMinimumWords: SEO_ARTICLE_RECOVERY_MIN_WORDS,
      targetMaximumWords: SEO_ARTICLE_RECOVERY_MAX_WORDS,
    });
    expect(prompt).toMatch(/Add at most \d\d new words/);
    expect(prompt).toContain("only finish the ending cleanly");

    // At or past the buffered maximum, the pass may only close the article.
    const ceiling = buildArticleContinuationPrompt({
      bodyMarkdown: `# Guide\n\n## Only section\n\n${words(2_900)} and this trails off`,
      researchEvidence: "",
      targetMinimumWords: SEO_ARTICLE_RECOVERY_MIN_WORDS,
      targetMaximumWords: SEO_ARTICLE_RECOVERY_MAX_WORDS,
    });
    expect(ceiling).toContain("one complete closing sentence only");
    expect(ceiling).not.toMatch(/Add at most [\d,]+ new words/);

    const roomy = buildArticleContinuationPrompt({
      bodyMarkdown: "# Guide\n\n## Only section\n\nA short draft.",
      researchEvidence: "",
      targetMinimumWords: SEO_ARTICLE_RECOVERY_MIN_WORDS,
      targetMaximumWords: SEO_ARTICLE_RECOVERY_MAX_WORDS,
    });
    expect(roomy).toMatch(/Add at most 2,8\d\d new words/);
  });

  it("keeps heading levels contiguous when demoting a continuation section with nested H3s", () => {
    const full = `# T\n\n${Array.from({ length: 9 }, (_, index) => `## S${index + 1}\n\nText.`).join("\n\n")}`;
    const continuation = "Bridge.\n\n## Excess section\n\n### Nested subtopic\n\nBody text ends cleanly.";
    const merged = mergeArticleContinuation(full, continuation);

    expect(countH2Sections(merged)).toBe(9);
    expect(merged).toContain("### Excess section");
    // The nested H3 now sits under an H3; H4 nesting is not required for the
    // demoted branch to stay contiguous (no level is skipped downward).
    expect(merged).toContain("### Nested subtopic");
  });

  it("clampContinuationHeadings is deterministic and leaves H3s and prose untouched", () => {
    const existing = `# T\n\n${Array.from({ length: 9 }, (_, index) => `## S${index + 1}\n\nText.`).join("\n\n")}`;
    const continuation = "Plain prose stays.\n\n## New H2\n\n### Existing H3 stays\n\nMore prose.";
    const clamped = clampContinuationHeadings(existing, continuation);

    expect(clamped).toContain("### New H2");
    expect(clamped).toContain("### Existing H3 stays");
    expect(clamped).toContain("Plain prose stays.");
    expect(clampContinuationHeadings(existing, continuation)).toBe(clamped);
  });

  it("regression: cleanly ended 1,755- and 1,760-word drafts get the expansion framing with computed missing words", () => {
    // Live failures: "background screening services" (1,755 words) and
    // "volunteer background check service" (1,760 words) ended cleanly, so
    // the finishing pass declared them complete instead of expanding them.
    for (const total of [1_755, 1_760]) {
      const body = `# Guide\n\n${Array.from({ length: 7 }, (_, index) => `## Section ${index + 1}\n\n${words(Math.floor(total / 7) - 3)}. This section ends cleanly.`).join("\n\n")}`;
      const decision = articleContinuationDecision(body, "seo_article", "end_turn");
      expect(decision).toMatchObject({ needed: true, reason: "short", cleanEnding: true });

      const prompt = buildArticleContinuationPrompt({
        bodyMarkdown: body,
        researchEvidence: "",
        targetMinimumWords: SEO_ARTICLE_RECOVERY_MIN_WORDS,
        targetMaximumWords: SEO_ARTICLE_RECOVERY_MAX_WORDS,
        reason: decision.reason,
      });
      expect(prompt).toContain("Expand the existing SEO article");
      expect(prompt).toContain("H3 subsections under the most relevant existing H2 sections");
      expect(prompt).toContain("Never state or imply that the article is already complete");
      expect(prompt).toContain("Return only article Markdown");
      expect(prompt).not.toContain("only finish the ending cleanly");
      // Computed deficit: 2,200 minimum minus the existing word count.
      const existingWords = decision.wordCount;
      expect(prompt).toContain(`is at least ${(2_200 - existingWords).toLocaleString("en-US")} words below Destiny's minimum`);
    }
  });

  it("regression: a 1,995-word boundary draft still gets the short expansion pass, not the finish framing", () => {
    // Live failure: "criminal background check for employees" ended around
    // 1,995 words and stayed incomplete after recovery.
    const body = `# Guide\n\n${Array.from({ length: 8 }, (_, index) => `## Section ${index + 1}\n\n${words(244)}. Ends cleanly.`).join("\n\n")}`;
    const decision = articleContinuationDecision(body, "seo_article", "end_turn");
    expect(decision.reason).toBe("short");

    const prompt = buildArticleContinuationPrompt({
      bodyMarkdown: body,
      researchEvidence: "",
      targetMinimumWords: SEO_ARTICLE_RECOVERY_MIN_WORDS,
      targetMaximumWords: SEO_ARTICLE_RECOVERY_MAX_WORDS,
      reason: decision.reason,
    });
    expect(prompt).toContain("Expand the existing SEO article");
    expect(prompt).toContain("It is NOT complete until it reaches the target");
  });

  it("regression: deterministically rejects the observed refusal instead of merging it", () => {
    // Exact live meta-commentary that was appended to articles.
    const refusal = "The existing article is already complete... No additional content should be appended.";
    expect(isContinuationRefusal(refusal)).toBe(true);
    expect(() => parseArticleContinuation(refusal)).toThrow(/commentary about the article/);
    expect(() => mergeArticleContinuation("# Guide\n\n## Section\n\nComplete sentence.", refusal)).toThrow(/commentary about the article/);

    for (const variant of [
      "This article covers everything required. Nothing more should be added.",
      "No additional content is needed; the draft already meets the target.",
      "I cannot add more without repeating existing sections.",
      "Nothing else to append.",
      "The draft requires no further expansion.",
    ]) {
      expect(isContinuationRefusal(variant), variant).toBe(true);
    }
  });

  it("does not misclassify genuine article copy as a refusal", () => {
    for (const copy of [
      "### When a screening is already complete\n\nEmployers still verify records before extending offers.",
      "Employers often ask what happens when the article of incorporation is missing. The answer starts with the county clerk.",
      "Short closing sentence that wraps up the guide with a clear next step for readers.",
      // Legitimate prose may open by referencing the article without refusing.
      "This article helps hiring managers compare screening policies across state lines and pick a compliant provider.",
      "The article's evidence shows turnaround times vary widely, so plan volunteer onboarding around the slowest county check.",
      "The draft guidance above applies to staffing agencies too, with one extra consent form required in California.",
      // Generic fragments in short, unheaded domain prose must not trip the fallback.
      "A basic name check requires no additional content from applicants.",
      "This article requires no subscription to follow the steps.",
      "Most county searches require no additional content beyond a signed consent form.",
      "No additional consent is necessary when the check relies on publicly available records.",
      "No additional documentation is needed for a county-only search, which keeps volunteer onboarding fast.",
      "Nothing more than a signed consent form is needed for this check.",
      "There is nothing illegal about using a county-record search.",
    ]) {
      expect(isContinuationRefusal(copy), copy).toBe(false);
    }
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
