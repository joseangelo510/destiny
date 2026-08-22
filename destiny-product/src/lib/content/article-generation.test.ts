import { describe, expect, it } from "vitest";
import {
  DEFAULT_ARTICLE_PREFERENCES,
  DEFAULT_COPY_MODEL,
  articleGenerationCapability,
  articleInternalLinkIssues,
  articleQualityIssuesFromPolicy,
  buildAnthropicArticleRequest,
  buildAnthropicArticleContinuationRequest,
  buildArticleGenerationPrompt,
  buildSearchEvidencePack,
  renderInfographicSvg,
  validateGeneratedArticle,
  type GeneratedArticlePayload,
} from "./article-generation";

function validLongFormPayload(): GeneratedArticlePayload {
  const sections = [
    ["## SEO Content Strategy: Start With the Searcher", "### Turn intent into a useful outline"],
    ["## What the Best Pages Explain First", "### Answer the decision behind the query"],
    ["## A Practical Research Workflow", "### Verify every claim before drafting"],
    ["## Why Generic Advice Falls Flat", "### Add a point of view competitors cannot copy"],
    ["## Measure the Result That Matters", "### Connect rankings to qualified action"],
    ["## Your Next Publishing Step", "### Review the draft before it goes live"],
  ];
  const paragraphs = sections.flatMap(([h2, h3], sectionIndex) => {
    const words = Array.from({ length: 345 }, (_, wordIndex) => `detail${sectionIndex}x${wordIndex}`).join(" ");
    const citation = sectionIndex < 3 ? ` [Verified source ${sectionIndex + 1}](https://example.com/source-${sectionIndex + 1})` : "";
    return [h2, "", `So what should you do with section ${sectionIndex + 1}?`, "", `${words}${citation}`, "", h3, "", `Use this worked example for section ${sectionIndex + 1}.`];
  });
  return {
    title: "SEO Content Strategy: A Practical Growth Guide",
    metaTitle: "SEO Content Strategy: A Practical Growth Guide",
    titleCandidates: [
      ["numbered", "7 SEO Content Strategy Steps for Sustainable Growth", "7 SEO Content Strategy Steps for Growth"],
      ["how_to", "How to Build an SEO Content Strategy That Converts", "How to Build an SEO Content Strategy"],
      ["second_person", "Your Practical SEO Content Strategy for Sustainable Growth", "Your Practical SEO Content Strategy"],
      ["question", "What Makes an SEO Content Strategy Actually Work?", "What Makes an SEO Content Strategy Work?"],
      ["descriptive", "SEO Content Strategy: A Practical Growth Guide", "SEO Content Strategy: A Practical Guide"],
      ["benefit", "Build an SEO Content Strategy That Drives Qualified Demand", "SEO Content Strategy for Qualified Demand"],
    ].map(([format, headline, metaTitle], index) => ({ format, headline, metaTitle, score: 95 - index, rationale: "Matches the verified search intent without unsupported claims." })) as GeneratedArticlePayload["titleCandidates"],
    metaDescriptions: ["Build an SEO content strategy with credible research, useful examples, and a clear publishing plan."],
    bodyMarkdown: ["# SEO Content Strategy: A Practical Growth Guide", "", ...paragraphs].join("\n"),
    bucketBrigades: sections.map((_, index) => ({ text: `So what should you do with section ${index + 1}?`, afterWord: 100 + index * 330 })),
    sources: [1, 2, 3].map((index) => ({
      id: `source-${index}`,
      title: `Verified source ${index}`,
      url: `https://example.com/source-${index}`,
    })),
    infographics: [],
  };
}

describe("Destiny article generation policy", () => {
  it("requires three unique verified internal links when the inventory supports them", () => {
    const payload = {
      bodyMarkdown: [
        "Read our [SEO services](https://example.com/services/seo).",
        "Use the [content strategy guide](https://example.com/guides/content).",
        "Then review [technical SEO](https://example.com/guides/technical).",
      ].join("\n\n"),
    };
    const inventory = [
      { title: "SEO services", url: "https://example.com/services/seo" },
      { title: "Content strategy", url: "https://example.com/guides/content" },
      { title: "Technical SEO", url: "https://example.com/guides/technical" },
      { title: "About", url: "https://example.com/about" },
    ];
    expect(articleInternalLinkIssues(payload, inventory)).toEqual([]);
    expect(articleInternalLinkIssues({ bodyMarkdown: payload.bodyMarkdown.replace(/\n\nThen[\s\S]+$/, "") }, inventory))
      .toContainEqual(expect.objectContaining({ code: "internal_link_count" }));
  });

  it("blocks fabricated same-site links while leaving external citations alone", () => {
    const inventory = [
      { title: "Home", url: "https://example.com/" },
      { title: "Services", url: "https://example.com/services" },
    ];
    const issues = articleInternalLinkIssues({
      bodyMarkdown: "[Home](https://example.com/) [Services](https://example.com/services) [Made up](https://example.com/not-real) [Source](https://research.example/report)",
    }, inventory);
    expect(issues).toContainEqual(expect.objectContaining({ code: "internal_link_unverified" }));
    expect(issues).not.toContainEqual(expect.objectContaining({ message: expect.stringContaining("research.example") }));
  });

  it("uses every verified page when a small site has fewer than three", () => {
    const inventory = [{ title: "Home", url: "https://example.com/" }, { title: "About", url: "https://example.com/about" }];
    expect(articleInternalLinkIssues({ bodyMarkdown: "[Home](https://example.com/) and [About](https://example.com/about)." }, inventory)).toEqual([]);
  });

  it("keeps Jose's approved controls and SEO-article defaults", () => {
    expect(DEFAULT_ARTICLE_PREFERENCES).toEqual({
      voice: "punchy_coach",
      format: "seo_article",
      readingEase: "simple_clear",
      specialInstructions: "",
      addInfographics: true,
    });
    expect(DEFAULT_COPY_MODEL).toBe("claude-opus-4-8");
  });

  it("reports the real article model capability instead of advertising an unavailable model", () => {
    expect(articleGenerationCapability(undefined, "claude-opus-4-8")).toEqual({
      available: false,
      model: "claude-opus-4-8",
      label: "Claude Opus 4.8",
    });
    expect(articleGenerationCapability("server-secret", "claude-opus-4-8")).toMatchObject({ available: true });
  });

  it("builds a hidden prompt with the locked long-form, heading, brigade, source, and graphics rules", () => {
    const prompt = buildArticleGenerationPrompt({
      keyword: "seo content strategy",
      businessName: "Destiny",
      problemSolved: "Founders need a repeatable organic growth system.",
      idealCustomer: "Founder-led businesses",
      differentiation: "Fifteen years of practical SEO experience",
      internalPages: [{ title: "Destiny home", url: "https://example.com/", text: "SEO coaching for founders" }],
      preferences: { ...DEFAULT_ARTICLE_PREFERENCES, specialInstructions: "Mention the free strategy call once." },
    });

    expect(prompt).toContain("2,000–3,000 words");
    expect(prompt).toContain("6–9 H2 sections");
    // Structural headroom: initial generation must aim inside the policy
    // band, reserving word and H2 budget for the bounded finishing pass.
    expect(prompt).toContain("2,300–2,800 words");
    expect(prompt).toContain("exactly 6–8 H2 sections");
    expect(prompt).toContain("never plan 9 or more");
    expect(prompt).toContain("4–9 contextual bucket brigades");
    expect(prompt).toContain("first 150 words");
    expect(prompt).toContain("at least 40% of headings");
    expect(prompt).toContain("original infographic");
    expect(prompt).toContain("Mention the free strategy call once.");
    expect(prompt).toContain("Never fabricate");
    expect(prompt).toContain("Generate exactly six title candidates");
    expect(prompt).toContain("40–60 characters");
    expect(prompt).toContain("do not copy a competitor title");
    expect(prompt).not.toContain("write like Neil Patel");
  });

  it("builds a deterministic DataForSEO evidence pack before the tool-free writing request", () => {
    const evidence = buildSearchEvidencePack({
      status_code: 20000,
      tasks: [{ status_code: 20000, result: [{ items: [1, 2, 3].map((index) => ({
        type: "organic",
        title: `Verified source ${index}`,
        url: `https://example${index}.gov/guidance`,
        description: `Evidence summary ${index}`,
      })) }] }],
    });
    expect(evidence).toContain("https://example1.gov/guidance");
    expect(evidence).toContain("Evidence summary 3");
    const request = buildAnthropicArticleRequest("Write from this verified evidence pack.", "claude-opus-4-8");
    expect(request.model).toBe("claude-opus-4-8");
    expect(request.max_tokens).toBe(9000);
    expect(request).not.toHaveProperty("tools");
    expect(request.output_config.format.type).toBe("json_schema");
    expect(request.output_config.format.schema.required).toEqual(expect.arrayContaining(["metaTitle", "titleCandidates", "bodyMarkdown", "sources", "infographics"]));
    expect(request.output_config.format.schema.properties.titleCandidates).not.toHaveProperty("minItems");
    expect(request.output_config.format.schema.properties.titleCandidates).not.toHaveProperty("maxItems");
    expect(request.output_config.format.schema.properties.titleCandidates.items.properties.score).toEqual({ type: "integer" });
    expect(request.output_config.format.schema.required).toContain("metaDescription");
    expect(request.output_config.format.schema.required).not.toContain("metaDescriptions");
    expect(request.output_config.format.schema.properties.metaDescription).toEqual({ type: "string" });
    expect(request.output_config.format.schema.properties).not.toHaveProperty("metaDescriptions");
    expect(request.messages[0]).toEqual({ role: "user", content: "Write from this verified evidence pack." });
  });

  it("rejects misaligned or overlong meta titles and stacked headline hype", async () => {
    const valid = validLongFormPayload();
    const issues = await validateGeneratedArticle({
      ...valid,
      title: "The Ultimate Proven Easy SEO Content Strategy Guide",
      metaTitle: "A Completely Different Topic With a Needlessly Long Search Title That Will Be Truncated",
    }, "seo content strategy", "seo_article");

    expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "meta_title_length",
      "title_alignment",
      "title_hype",
    ]));
  });

  it("keeps the same honest list number in the headline and meta title", async () => {
    const valid = validLongFormPayload();
    const issues = await validateGeneratedArticle({
      ...valid,
      title: "7 SEO Content Strategy Steps for Sustainable Growth",
      metaTitle: "10 SEO Content Strategy Steps for Growth",
    }, "seo content strategy", "seo_article");

    expect(issues.map((issue) => issue.code)).toContain("title_number");
  });

  it("requires the article H1 to match the selected blog headline", async () => {
    const valid = validLongFormPayload();
    const issues = await validateGeneratedArticle({
      ...valid,
      bodyMarkdown: valid.bodyMarkdown.replace(/^# .+$/m, "# A Different Article Headline"),
    }, "seo content strategy", "seo_article");

    expect(issues.map((issue) => issue.code)).toContain("title_alignment");
  });

  it("normalizes unicode punctuation and whitespace before comparing the H1", async () => {
    const valid = validLongFormPayload();
    const title = "SEO Content Strategy: A Founder's Practical Guide";
    const issues = await validateGeneratedArticle({
      ...valid,
      title,
      metaTitle: title,
      bodyMarkdown: valid.bodyMarkdown.replace(/^# .+$/m, "# SEO   Content Strategy: A Founder’s Practical Guide"),
    }, "seo content strategy", "seo_article");

    expect(issues.map((issue) => issue.code)).not.toContain("title_alignment");
  });

  it("verifies that a numbered-list promise matches the actual body sequence", async () => {
    const valid = validLongFormPayload();
    const title = "5 SEO Content Strategy Tips for Better Growth";
    const bodyMarkdown = valid.bodyMarkdown.replace(/^# .+$/m, `# ${title}`).replace("\n\n", "\n\n1. First tip\n2. Second tip\n3. Third tip\n4. Fourth tip\n\n");
    const issues = await validateGeneratedArticle({ ...valid, title, metaTitle: title, bodyMarkdown }, "seo content strategy", "seo_article");

    expect(issues.map((issue) => issue.code)).toContain("title_number");
  });

  it("continues a paused server-side research turn with the exact provider blocks", () => {
    const pausedContent = [{ type: "server_tool_use", id: "toolu_1", name: "web_search", input: { query: "SEO evidence" } }];
    const request = buildAnthropicArticleContinuationRequest("Research and write the article.", pausedContent, "claude-opus-4-8");

    expect(request.model).toBe("claude-opus-4-8");
    expect(request.tools).toBeUndefined();
    expect(request.messages).toEqual([
      { role: "user", content: "Research and write the article." },
      { role: "assistant", content: pausedContent },
    ]);
  });

  it("accepts a substantive SEO article and rejects short or stock-phrase drafts", async () => {
    const valid = validLongFormPayload();
    await expect(validateGeneratedArticle(valid, "seo content strategy", "seo_article")).resolves.toEqual([]);

    const invalid = {
      ...valid,
      bodyMarkdown: "# SEO Content Strategy\n\n## SEO Content Strategy Basics\n\nLet's dive in. This is short.",
      bucketBrigades: [{ text: "Let's dive in.", afterWord: 8 }],
    };
    expect((await validateGeneratedArticle(invalid, "seo content strategy", "seo_article")).map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "word_count",
      "heading_structure",
      "heading_variety",
      "brigade_count",
      "source_coverage",
      "stock_phrase",
    ]));
  });

  it("explains an over-fragmented H2 outline instead of showing a generic hierarchy warning", () => {
    const issues = articleQualityIssuesFromPolicy({
      articleWordIssue: false,
      articleHeadingIssue: true,
      articleHeadingKeywordIssue: false,
      articleHeadingVarietyIssue: false,
      articleBrigadeIssue: false,
      articleBrigadeSpacingIssue: false,
      articleStockIssue: false,
      articleMetaIssue: false,
      articleSourceIssue: false,
    }, {
      formatCode: 1,
      wordCount: 2_400,
      h1Count: 1,
      h2Count: 13,
      h3Count: 8,
      skippedLevel: 0,
      titleKeyword: 1,
      firstH2Keyword: 1,
      keywordFreePercent: 50,
      brigadeCount: 6,
      firstBrigade: 120,
      minBrigadeGap: 140,
      stockPhrase: 0,
      metaCount: 1,
      metaOverlength: 0,
      sourceCount: 4,
      citedCount: 4,
    }, "seo_article");

    expect(issues).toEqual([{ code: "heading_structure", message: "Consolidate the outline to 6–9 H2 sections; this draft has 13." }]);
  });

  it("renders an original, source-labeled SVG instead of reusing a third-party infographic", () => {
    const svg = renderInfographicSvg({
      id: "steps-1",
      template: "steps",
      title: "A Better Content Workflow",
      insight: "Research before writing",
      items: ["Find intent", "Verify sources", "Draft", "Review"],
      sourceLabel: "Source: Destiny article research",
      altText: "Four-step content workflow from search intent through review",
    });
    expect(svg).toContain("<svg");
    expect(svg).toContain("A Better Content Workflow");
    expect(svg).toContain("Source: Destiny article research");
    expect(svg).not.toContain("<image");
  });
});
