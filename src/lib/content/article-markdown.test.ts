import { describe, expect, it } from "vitest";
import {
  GENERATION_STAGES,
  articleTableOfContents,
  estimatedReadMinutes,
  generationStageIndex,
  parseArticleInline,
  parseArticleMarkdown,
  safeArticleLinkUrl,
} from "./article-markdown";

describe("parseArticleMarkdown", () => {
  it("renders headings, paragraphs, lists, and links as a readable document", () => {
    const blocks = parseArticleMarkdown([
      "## Why timing matters",
      "",
      "Junk removal pricing depends on **volume** and [local rules](https://example.com/rules).",
      "",
      "- Book a morning slot",
      "- Confirm the quote in writing",
      "",
      "1. Measure the pile",
      "2. Photograph access points",
      "",
      "### A smaller question",
      "One more paragraph.",
    ].join("\n"));

    expect(blocks[0]).toEqual({ type: "heading", level: 2, text: "Why timing matters", id: "article-why-timing-matters" });
    const paragraph = blocks[1];
    if (paragraph.type !== "paragraph") throw new Error("expected paragraph");
    expect(paragraph.tokens).toContainEqual({ type: "strong", text: "volume" });
    expect(paragraph.tokens).toContainEqual({ type: "link", text: "local rules", url: "https://example.com/rules" });
    expect(blocks[2]).toMatchObject({ type: "list", ordered: false });
    expect(blocks[3]).toMatchObject({ type: "list", ordered: true });
    expect(blocks[4]).toMatchObject({ type: "heading", level: 3 });
    expect(blocks[5]).toMatchObject({ type: "paragraph" });
  });

  it("parses plain text without markdown syntax as paragraphs", () => {
    expect(parseArticleInline("No special syntax here.")).toEqual([{ type: "text", text: "No special syntax here." }]);
  });

  it("refuses unsafe link protocols and keeps the link text as plain text", () => {
    expect(parseArticleInline("Click [here](javascript:alert-now) now.")).toEqual([
      { type: "text", text: "Click " },
      { type: "text", text: "here" },
      { type: "text", text: " now." },
    ]);
    expect(safeArticleLinkUrl("data:text/html,x")).toBeNull();
    expect(safeArticleLinkUrl("https://example.com/a")).toBe("https://example.com/a");
    expect(safeArticleLinkUrl("mailto:team@example.com")).toBe("mailto:team@example.com");
  });
});

describe("articleTableOfContents", () => {
  it("lists only H2 sections for the compact table of contents", () => {
    const toc = articleTableOfContents("## First section\n\ntext\n\n### Sub question\n\n## Second section\n");
    expect(toc).toEqual([
      { id: "article-first-section", text: "First section" },
      { id: "article-second-section", text: "Second section" },
    ]);
  });
});

describe("estimatedReadMinutes", () => {
  it("estimates read time for a 2,000–3,000 word article", () => {
    expect(estimatedReadMinutes(2300)).toBe(10);
    expect(estimatedReadMinutes(50)).toBe(1);
  });
});

describe("generation stages", () => {
  it("uses truthful timed labels in lifecycle order", () => {
    expect(GENERATION_STAGES.map((stage) => stage.label)).toEqual([
      "Researching your topic…",
      "Reading sources…",
      "Writing your draft…",
      "Polishing headings and metadata…",
    ]);
  });

  it("advances stages over elapsed time and stays within the request budget", () => {
    expect(generationStageIndex(0)).toBe(0);
    expect(generationStageIndex(30_000)).toBe(1);
    expect(generationStageIndex(120_000)).toBe(2);
    expect(generationStageIndex(250_000)).toBe(3);
    expect(GENERATION_STAGES[3].afterMs).toBeLessThan(280_000);
  });
});
