import { describe, expect, it } from "vitest";
import {
  DEFAULT_ARTICLE_PREFERENCES,
  DEFAULT_COPY_MODEL,
  articleGenerationCapability,
  buildAnthropicArticleRequest,
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
  it("keeps Jose's approved controls and SEO-article defaults", () => {
    expect(DEFAULT_ARTICLE_PREFERENCES).toEqual({
      voice: "punchy_coach",
      format: "seo_article",
      readingEase: "simple_clear",
      specialInstructions: "",
      addInfographics: true,
    });
    expect(DEFAULT_COPY_MODEL).toBe("claude-sonnet-4-6");
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

    expect(prompt).toContain("2,000–2,200 words");
    expect(prompt).toContain("6–8 H2 sections");
    expect(prompt).toContain("4–9 contextual bucket brigades");
    expect(prompt).toContain("first 150 words");
    expect(prompt).toContain("at least 40% of headings");
    expect(prompt).toContain("original infographic");
    expect(prompt).toContain("Mention the free strategy call once.");
    expect(prompt).toContain("Never fabricate");
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
    const request = buildAnthropicArticleRequest("Write from this verified evidence pack.", "claude-sonnet-4-6");
    expect(request.model).toBe("claude-sonnet-4-6");
    expect(request.max_tokens).toBe(9000);
    expect(request).not.toHaveProperty("tools");
    expect(request.output_config.format.type).toBe("json_schema");
    expect(request.output_config.format.schema.required).toEqual(expect.arrayContaining(["bodyMarkdown", "sources", "infographics"]));
    expect(request.output_config.format.schema.required).toContain("metaDescription");
    expect(request.output_config.format.schema.required).not.toContain("metaDescriptions");
    expect(request.output_config.format.schema.properties.metaDescription).toEqual({ type: "string" });
    expect(request.output_config.format.schema.properties).not.toHaveProperty("metaDescriptions");
    expect(request.messages[0]).toEqual({ role: "user", content: "Write from this verified evidence pack." });
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
