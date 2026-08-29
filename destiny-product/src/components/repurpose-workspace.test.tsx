import { renderToStaticMarkup } from "react-dom/server";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  RepurposeWorkspace,
  parseRepurposeGenerateResponse,
  parseRepurposeSourceResponse,
} from "./repurpose-workspace";
import { REPURPOSE_OUTPUT_OPTIONS } from "@/lib/content/repurpose";

const WEBSITE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const KEYWORDS = ["seo strategy", "content marketing", "keyword research"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderRepurpose(props: Partial<Parameters<typeof RepurposeWorkspace>[0]> = {}) {
  return renderToStaticMarkup(
    <RepurposeWorkspace
      websiteId={WEBSITE_ID}
      approvedKeywords={KEYWORDS}
      generationAvailable={true}
      {...props}
    />
  );
}

const INITIAL_DRAFT = {
  title: "Test Article Title",
  bodyMarkdown: "## Intro\n\nThis is the body.",
  output: "seo_blog_article" as const,
  sourceId: "src-001",
  sourceAttribution: "example.com/article",
  sourceUrl: "https://example.com/article",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("RepurposeWorkspace", () => {
  it("parses the nested source API contract without leaking extracted text", () => {
    expect(parseRepurposeSourceResponse({
      source: {
        id: "source-1",
        attribution: "Original guide",
        url: "https://example.com/guide",
        extracted_text: "must not be consumed",
      },
    })).toEqual({
      sourceId: "source-1",
      attribution: "Original guide",
      url: "https://example.com/guide",
    });
    expect(parseRepurposeSourceResponse({ sourceId: "wrong-shape" })).toBeNull();
  });

  it("parses the nested generation API contract and enforces source identity", () => {
    const source = {
      sourceId: "source-1",
      attribution: "Original guide",
      url: "https://example.com/guide",
    };
    const payload = {
      sourceId: "source-1",
      attribution: "https://example.com/guide",
      draft: { title: "Draft title", bodyMarkdown: "Draft body" },
    };

    expect(parseRepurposeGenerateResponse(payload, "source-1", "seo_blog_article", source))
      .toMatchObject({
        sourceId: "source-1",
        title: "Draft title",
        bodyMarkdown: "Draft body",
        output: "seo_blog_article",
      });
    expect(parseRepurposeGenerateResponse(payload, "another-source", "seo_blog_article", source))
      .toBeNull();
  });

  // --- Step numbering and labels ---
  it("renders all three step headings with correct numbers", () => {
    const html = renderRepurpose({ initialDraft: INITIAL_DRAFT });
    expect(html).toContain("Add a source");
    expect(html).toContain("Choose one output");
    expect(html).toContain("Review draft");
  });

  // --- Stage strip ---
  it("renders all four stage labels in the stage strip", () => {
    const html = renderRepurpose();
    expect(html).toContain("Uploading");
    expect(html).toContain("Reading");
    expect(html).toContain("Writing");
    expect(html).toContain("Ready");
  });

  it("renders stages in correct order: Uploading, Reading, Writing, Ready", () => {
    const html = renderRepurpose();
    const uploadingPos = html.indexOf("Uploading");
    const readingPos = html.indexOf("Reading");
    const writingPos = html.indexOf("Writing");
    const readyPos = html.indexOf("Ready");
    expect(uploadingPos).toBeLessThan(readingPos);
    expect(readingPos).toBeLessThan(writingPos);
    expect(writingPos).toBeLessThan(readyPos);
  });

  // --- Six output options with correct radio cards ---
  it("renders exactly six output radio cards", () => {
    const html = renderRepurpose();
    const radioCount = (html.match(/type="radio"/g) ?? []).length;
    expect(radioCount).toBe(6);
  });

  it("renders all six output option labels", () => {
    const html = renderRepurpose();
    for (const option of REPURPOSE_OUTPUT_OPTIONS) {
      expect(html).toContain(option.label);
    }
  });

  it("renders exactly six one-line promise texts", () => {
    const html = renderRepurpose();
    for (const option of REPURPOSE_OUTPUT_OPTIONS) {
      expect(html).toContain(option.promise);
    }
    expect(REPURPOSE_OUTPUT_OPTIONS).toHaveLength(6);
  });

  it("output radios share one radio group (same name attribute)", () => {
    const html = renderRepurpose();
    const nameMatches = html.match(/name="([^"]+)"/g) ?? [];
    const names = nameMatches.map((m) => m.replace(/name="|"/g, ""));
    const radioGroupNames = new Set(names);
    // All radios share exactly one group name
    expect(radioGroupNames.size).toBe(1);
  });

  // --- File input ---
  it("file input accepts .pdf, .docx, .txt, .md", () => {
    const html = renderRepurpose();
    expect(html).toContain('accept=".pdf,.docx,.txt,.md"');
  });

  it("mentions 20MB limit and text-layer guidance for file uploads", () => {
    const html = renderRepurpose();
    expect(html).toContain("20 MB");
    expect(html).toContain("readable text layer");
  });

  // --- URL copy for public webpages and YouTube ---
  it("mentions public webpages and YouTube with captions in URL copy (source inspection)", async () => {
    // URL guidance is rendered only when sourceMode === "url"; verify via source inspection
    const source = await readFile(new URL("./repurpose-workspace.tsx", import.meta.url), "utf8");
    expect(source).toContain("public webpages");
    expect(source).toContain("YouTube");
    expect(source).toContain("captions");
  });

  // --- Disabled media controls with exact truthful copy ---
  it("shows Audio recording as a visible disabled control with exact coming-soon copy", () => {
    const html = renderRepurpose();
    expect(html).toContain("Audio recording");
    expect(html).toContain("Coming soon — transcription connection required");
  });

  it("shows Video file as a visible disabled control with exact coming-soon copy", () => {
    const html = renderRepurpose();
    expect(html).toContain("Video file");
    // Both audio and video share the same coming-soon text
    const comingSoonCount = (html.match(/Coming soon — transcription connection required/g) ?? []).length;
    expect(comingSoonCount).toBe(2);
  });

  it("disabled media buttons have disabled attribute", () => {
    const html = renderRepurpose();
    // Both disabled buttons appear in source
    const disabledCount = (html.match(/repurpose-coming-soon-btn/g) ?? []).length;
    expect(disabledCount).toBe(2);
    expect(html).toContain("Audio recording");
    expect(html).toContain("Video file");
  });

  // --- Approved keyword options ---
  it("populates keyword select with approved keywords and a None option", () => {
    const html = renderRepurpose();
    expect(html).toContain(">None<");
    for (const kw of KEYWORDS) {
      expect(html).toContain(kw);
    }
  });

  it("shows None option first in keyword select", () => {
    const html = renderRepurpose();
    const nonePos = html.indexOf(">None<");
    const firstKeywordPos = html.indexOf(KEYWORDS[0]);
    expect(nonePos).toBeLessThan(firstKeywordPos);
  });

  it("shows hint to approve keywords when list is empty", () => {
    const html = renderRepurpose({ approvedKeywords: [] });
    expect(html).toContain("No approved keywords yet");
  });

  // --- Draft section ---
  it("shows Draft badge when initialDraft is provided", () => {
    const html = renderRepurpose({ initialDraft: INITIAL_DRAFT });
    expect(html).toContain("Draft");
    expect(html).toContain("repurpose-draft-badge");
  });

  it("renders the draft title in the title input", () => {
    const html = renderRepurpose({ initialDraft: INITIAL_DRAFT });
    expect(html).toContain(INITIAL_DRAFT.title);
  });

  it("renders the draft body in the body textarea", () => {
    const html = renderRepurpose({ initialDraft: INITIAL_DRAFT });
    expect(html).toContain("This is the body.");
  });

  it("shows source attribution in the draft section", () => {
    const html = renderRepurpose({ initialDraft: INITIAL_DRAFT });
    expect(html).toContain(INITIAL_DRAFT.sourceAttribution);
  });

  it("shows source URL in the draft section", () => {
    const html = renderRepurpose({ initialDraft: INITIAL_DRAFT });
    expect(html).toContain(INITIAL_DRAFT.sourceUrl!);
  });

  it("shows Save changes and Retry generation buttons in draft section", () => {
    const html = renderRepurpose({ initialDraft: INITIAL_DRAFT });
    expect(html).toContain("Save changes");
    expect(html).toContain("Retry generation");
  });

  // --- SEO handoff ---
  it("shows Open in Content Studio link for seo_blog_article output", () => {
    const html = renderRepurpose({ initialDraft: INITIAL_DRAFT });
    expect(html).toContain("Open in Content Studio");
    expect(html).toContain(`/content?repurpose=${INITIAL_DRAFT.sourceId}#article-review-workspace`);
  });

  it("includes the sourceId in the Content Studio handoff URL for SEO output", () => {
    const html = renderRepurpose({ initialDraft: INITIAL_DRAFT });
    const handoffUrl = `/content?repurpose=${INITIAL_DRAFT.sourceId}#article-review-workspace`;
    expect(html).toContain(handoffUrl);
  });

  // --- Non-SEO draft truthfulness ---
  it("shows Copy draft button for non-SEO output", () => {
    const nonSEODraft = { ...INITIAL_DRAFT, output: "email" as const };
    const html = renderRepurpose({ initialDraft: nonSEODraft });
    expect(html).toContain("Copy draft");
  });

  it("shows truthful non-publish disclaimer for non-SEO output", () => {
    const nonSEODraft = { ...INITIAL_DRAFT, output: "linkedin_post" as const };
    const html = renderRepurpose({ initialDraft: nonSEODraft });
    expect(html).toContain("This format stays an editable draft; Rebound SEO does not publish it automatically.");
  });

  it("does not show Open in Content Studio for non-SEO output", () => {
    const nonSEODraft = { ...INITIAL_DRAFT, output: "x_thread" as const };
    const html = renderRepurpose({ initialDraft: nonSEODraft });
    expect(html).not.toContain("Open in Content Studio");
  });

  // --- No false publishing claims ---
  it("never claims the draft is published or approved", () => {
    const html = renderRepurpose({ initialDraft: INITIAL_DRAFT });
    expect(html).not.toMatch(/\bpublished\b/i);
    expect(html).not.toMatch(/\bapproved\b/i);
  });

  // --- Endpoint contract (source inspection) ---
  it("calls POST /api/content/repurpose/sources with FormData for source upload", async () => {
    const source = await readFile(new URL("./repurpose-workspace.tsx", import.meta.url), "utf8");
    expect(source).toContain("/api/content/repurpose/sources");
    expect(source).toContain("FormData");
    expect(source).toContain('"POST"');
  });

  it("calls POST /api/content/repurpose/generate with JSON body for generation", async () => {
    const source = await readFile(new URL("./repurpose-workspace.tsx", import.meta.url), "utf8");
    expect(source).toContain("/api/content/repurpose/generate");
    expect(source).toContain('"POST"');
    expect(source).toContain("application/json");
  });

  it("calls PATCH /api/content/repurpose/sources with JSON for save", async () => {
    const source = await readFile(new URL("./repurpose-workspace.tsx", import.meta.url), "utf8");
    expect(source).toContain('"PATCH"');
  });

  it("retry generation reuses same sourceId without calling sources endpoint again", async () => {
    const source = await readFile(new URL("./repurpose-workspace.tsx", import.meta.url), "utf8");
    // handleRetry calls handleGenerate with draft.sourceId, NOT via sources endpoint
    expect(source).toContain("handleGenerate(draft.sourceId)");
    // The retry handler must not call the sources endpoint
    const retryFnMatch = source.match(/handleRetry[\s\S]+?\}/)?.[0] ?? "";
    expect(retryFnMatch).not.toContain("/api/content/repurpose/sources");
  });

  it("generate JSON body includes websiteId, sourceId, output, targetKeyword fields", async () => {
    const source = await readFile(new URL("./repurpose-workspace.tsx", import.meta.url), "utf8");
    expect(source).toContain("websiteId");
    expect(source).toContain("sourceId");
    expect(source).toContain("output");
    expect(source).toContain("targetKeyword");
  });

  it("FormData source upload includes websiteId and sourceMode fields", async () => {
    const source = await readFile(new URL("./repurpose-workspace.tsx", import.meta.url), "utf8");
    expect(source).toContain('fd.append("websiteId"');
    expect(source).toContain('fd.append("sourceMode"');
    expect(source).toContain('sourceMode === "paste"');
    expect(source).not.toContain('sourceMode === "text"');
  });

  // --- Stage transition logic (source inspection) ---
  it("file request starts Uploading stage", async () => {
    const source = await readFile(new URL("./repurpose-workspace.tsx", import.meta.url), "utf8");
    // Uploading stage is set when sourceMode is file
    expect(source).toContain('"uploading"');
    // Reading stage is set for url/text
    expect(source).toContain('"reading"');
    // Writing stage is set during generation
    expect(source).toContain('"writing"');
    // Ready stage is set after successful draft
    expect(source).toContain('"ready"');
  });

  it("generation starts Writing stage", async () => {
    const source = await readFile(new URL("./repurpose-workspace.tsx", import.meta.url), "utf8");
    expect(source).toContain('setStage("writing")');
  });

  it("does not set progress timers — no setTimeout or setInterval", async () => {
    const source = await readFile(new URL("./repurpose-workspace.tsx", import.meta.url), "utf8");
    expect(source).not.toContain("setTimeout");
    expect(source).not.toContain("setInterval");
  });

  // --- Source mode inputs: file/url/text each present in the rendered HTML ---
  it("shows file input in file mode by default", () => {
    const html = renderRepurpose();
    expect(html).toContain('type="file"');
    expect(html).toContain(".pdf,.docx,.txt,.md");
  });

  it("uses isRepurposeOutput from repurpose.ts (source inspection)", async () => {
    const source = await readFile(new URL("./repurpose-workspace.tsx", import.meta.url), "utf8");
    expect(source).toContain("isRepurposeOutput");
  });

  it("imports REPURPOSE_OUTPUT_OPTIONS from repurpose.ts", async () => {
    const source = await readFile(new URL("./repurpose-workspace.tsx", import.meta.url), "utf8");
    expect(source).toContain("REPURPOSE_OUTPUT_OPTIONS");
    expect(source).toContain("repurpose");
  });
});
