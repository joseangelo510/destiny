import { describe, expect, it } from "vitest";
import {
  REPURPOSE_OUTPUT_OPTIONS,
  REPURPOSE_SOURCE_MODES,
  REPURPOSE_LIMITS,
  SOURCE_TEXT_LIMIT,
  buildRepurposePrompt,
  buildRepurposeAnthropicRequest,
  parseRepurposeResponse,
  canHandOffToContentStudio,
  repurposeHandoffLabel,
  repurposeOutputLabel,
  repurposeOutputPromise,
  repurposeStageLabel,
  isRepurposeOutput,
  isRepurposeSourceMode,
  safeRecord,
  safeString,
  safeNumber,
  type RepurposeOutput,
  type RepurposeStage,
} from "./repurpose";
import { DEFAULT_COPY_MODEL } from "./article-generation";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const SAMPLE_SOURCE_TEXT = `
Search engine optimisation (SEO) is the practice of improving a website's
visibility in organic search results. Key techniques include keyword research,
on-page optimisation, technical site health, and high-quality link acquisition.
Studies consistently show that the first organic result receives approximately
27 % of all clicks, making page-one placement commercially significant.
Businesses that publish useful, evidence-backed content see compounding traffic
growth over 12–24 months compared with those relying solely on paid advertising.
`.trim();

const SAMPLE_BUSINESS_CONTEXT =
  "Rebound SEO — an SEO content platform helping founder-led businesses grow organic traffic.";

function makePrompt(output: RepurposeOutput, keyword?: string) {
  return buildRepurposePrompt({
    source: { text: SAMPLE_SOURCE_TEXT, attribution: "https://example.com/seo-guide" },
    businessContext: SAMPLE_BUSINESS_CONTEXT,
    targetKeyword: keyword,
    output,
  });
}

// ---------------------------------------------------------------------------
// 1. All choices and promises
// ---------------------------------------------------------------------------

describe("REPURPOSE_OUTPUT_OPTIONS", () => {
  it("contains exactly six output options", () => {
    expect(REPURPOSE_OUTPUT_OPTIONS).toHaveLength(6);
  });

  it("has exactly the required value codes", () => {
    const codes = REPURPOSE_OUTPUT_OPTIONS.map((o) => o.value);
    expect(codes).toEqual(
      expect.arrayContaining([
        "seo_blog_article",
        "linkedin_post",
        "x_thread",
        "email",
        "faq",
        "outline",
      ]),
    );
    // No extra codes
    expect(codes).toHaveLength(6);
  });

  it("every option has a non-empty label and a one-line promise", () => {
    for (const option of REPURPOSE_OUTPUT_OPTIONS) {
      expect(option.label.trim().length).toBeGreaterThan(0);
      // A one-line promise must not contain a newline
      expect(option.promise).not.toMatch(/\n/);
      expect(option.promise.trim().length).toBeGreaterThan(10);
    }
  });

  it("repurposeOutputLabel returns the correct label for each code", () => {
    expect(repurposeOutputLabel("seo_blog_article")).toBe("SEO blog article");
    expect(repurposeOutputLabel("linkedin_post")).toBe("LinkedIn post");
    expect(repurposeOutputLabel("x_thread")).toBe("X thread");
    expect(repurposeOutputLabel("email")).toBe("Email");
    expect(repurposeOutputLabel("faq")).toBe("FAQ");
    expect(repurposeOutputLabel("outline")).toBe("Outline");
  });

  it("repurposeOutputPromise returns a non-empty promise for every code", () => {
    const codes: RepurposeOutput[] = [
      "seo_blog_article",
      "linkedin_post",
      "x_thread",
      "email",
      "faq",
      "outline",
    ];
    for (const code of codes) {
      const promise = repurposeOutputPromise(code);
      expect(promise.length).toBeGreaterThan(10);
    }
  });
});

describe("REPURPOSE_SOURCE_MODES", () => {
  it("shares the exact file, URL, and paste API values", () => {
    expect(REPURPOSE_SOURCE_MODES).toEqual(["file", "url", "paste"]);
    expect(isRepurposeSourceMode("paste")).toBe(true);
    expect(isRepurposeSourceMode("text")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Stage labels — uploading / reading / writing / ready only
// ---------------------------------------------------------------------------

describe("repurposeStageLabel", () => {
  it("returns the correct label for each of the four pipeline stages", () => {
    expect(repurposeStageLabel("uploading")).toBe("Uploading");
    expect(repurposeStageLabel("reading")).toBe("Reading");
    expect(repurposeStageLabel("writing")).toBe("Writing");
    expect(repurposeStageLabel("ready")).toBe("Ready");
  });

  it("RepurposeStage type only contains the four pipeline values", () => {
    // Compile-time exhaustiveness: if any case is missing the switch in the
    // implementation will not compile. We verify runtime coverage here.
    const stages: RepurposeStage[] = ["uploading", "reading", "writing", "ready"];
    expect(stages).toHaveLength(4);
    for (const stage of stages) {
      expect(repurposeStageLabel(stage)).toBeTruthy();
    }
  });

  it("does not recognise the removed idle/generating/draft_ready/published values", () => {
    // These values are no longer part of RepurposeStage; cast to bypass TS to
    // confirm the runtime switch has no case for them.
    const removed = ["idle", "generating", "draft_ready", "published"];
    for (const value of removed) {
      // The function must not return a known label for these
      const result = repurposeStageLabel(value as RepurposeStage);
      expect(["Not started", "Generating…", "Draft ready", "Published"]).not.toContain(result);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. isRepurposeOutput runtime guard
// ---------------------------------------------------------------------------

describe("isRepurposeOutput", () => {
  it("returns true for every valid output code", () => {
    const validCodes: RepurposeOutput[] = [
      "seo_blog_article",
      "linkedin_post",
      "x_thread",
      "email",
      "faq",
      "outline",
    ];
    for (const code of validCodes) {
      expect(isRepurposeOutput(code)).toBe(true);
    }
  });

  it("returns false for unknown strings", () => {
    expect(isRepurposeOutput("blog_post")).toBe(false);
    expect(isRepurposeOutput("seo")).toBe(false);
    expect(isRepurposeOutput("")).toBe(false);
    expect(isRepurposeOutput("SEO_BLOG_ARTICLE")).toBe(false);
  });

  it("returns false for non-string values", () => {
    expect(isRepurposeOutput(null)).toBe(false);
    expect(isRepurposeOutput(undefined)).toBe(false);
    expect(isRepurposeOutput(42)).toBe(false);
    expect(isRepurposeOutput({})).toBe(false);
    expect(isRepurposeOutput(["seo_blog_article"])).toBe(false);
  });

  it("narrows the type: a guarded value is assignable to RepurposeOutput", () => {
    const raw: unknown = "faq";
    if (isRepurposeOutput(raw)) {
      // TypeScript type narrowing — this line only compiles if the guard works
      const typed: RepurposeOutput = raw;
      expect(typed).toBe("faq");
    } else {
      throw new Error("Expected guard to pass for 'faq'");
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Exactly-one output validation — prompt contains only the requested format
// ---------------------------------------------------------------------------

describe("buildRepurposePrompt — one output at a time", () => {
  const ALL_LABELS = REPURPOSE_OUTPUT_OPTIONS.map((o) => o.label);

  it("injects the chosen output label and does not reference the other five", () => {
    for (const option of REPURPOSE_OUTPUT_OPTIONS) {
      const prompt = makePrompt(option.value);
      // The chosen label must appear
      expect(prompt).toContain(option.label);
      // The "Format:" declaration line must name only the selected output
      const formatLine = prompt.split("\n").find((line) => line.startsWith("Format:"));
      expect(formatLine).toBeDefined();
      expect(formatLine).toContain(option.label);
      const otherLabels = ALL_LABELS.filter((l) => l !== option.label);
      for (const other of otherLabels) {
        expect(formatLine).not.toContain(other);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Keyword bounding
// ---------------------------------------------------------------------------

describe("buildRepurposePrompt — keyword bounding", () => {
  it("includes the approved keyword when supplied", () => {
    const prompt = makePrompt("seo_blog_article", "organic seo strategy");
    expect(prompt).toContain("organic seo strategy");
    expect(prompt).toContain("APPROVED TARGET KEYWORD");
  });

  it("omits the keyword section when no keyword is supplied", () => {
    const prompt = makePrompt("linkedin_post", undefined);
    expect(prompt).toContain("None supplied");
    expect(prompt).not.toMatch(/organic seo strategy/i);
  });

  it("clips a keyword longer than 300 characters", () => {
    const longKeyword = "k".repeat(400);
    const prompt = makePrompt("email", longKeyword);
    expect(prompt).toContain("k".repeat(300));
    expect(prompt).not.toContain("k".repeat(301));
  });

  it("SOURCE_TEXT_LIMIT is exported and equals 60,000 characters", () => {
    expect(SOURCE_TEXT_LIMIT).toBe(60_000);
  });

  it("clips source text to SOURCE_TEXT_LIMIT (60,000) characters", () => {
    // Build a source that exceeds the limit
    const hugeSource = "word ".repeat(15_000); // 75,000 chars
    const prompt = buildRepurposePrompt({
      source: { text: hugeSource },
      businessContext: SAMPLE_BUSINESS_CONTEXT,
      output: "outline",
    });
    // Extract the content between the first pair of --- delimiters
    const parts = prompt.split("---");
    // parts[1] is the source text block (between first and second ---)
    const sourceSection = parts[1] ?? "";
    // Must not exceed 60,000 chars plus a small newline overhead
    expect(sourceSection.length).toBeLessThanOrEqual(60_100);
    // Must NOT contain the full 75,000-char input
    expect(prompt.length).toBeLessThan(hugeSource.length);
  });

  it("does not truncate source text that is within the 60,000 limit", () => {
    const shortSource = "word ".repeat(100); // 500 chars
    const prompt = buildRepurposePrompt({
      source: { text: shortSource },
      businessContext: SAMPLE_BUSINESS_CONTEXT,
      output: "faq",
    });
    expect(prompt).toContain(shortSource.trim());
  });
});

// ---------------------------------------------------------------------------
// 6. Prompt safeguards — critical rules and raw source text usage
// ---------------------------------------------------------------------------

describe("buildRepurposePrompt — safeguards", () => {
  it("labels output as DRAFT ONLY", () => {
    for (const option of REPURPOSE_OUTPUT_OPTIONS) {
      const prompt = makePrompt(option.value);
      expect(prompt).toMatch(/DRAFT ONLY/i);
    }
  });

  it("forbids fabricated facts", () => {
    const prompt = makePrompt("seo_blog_article");
    expect(prompt).toMatch(/NEVER fabricate/i);
  });

  it("forbids invented sources and URLs", () => {
    const prompt = makePrompt("faq");
    expect(prompt).toMatch(/NEVER invent sources/i);
  });

  it("forbids first-person claims", () => {
    const prompt = makePrompt("linkedin_post");
    expect(prompt).toMatch(/NEVER write in first-person/i);
  });

  it("requires faithful source attribution", () => {
    const prompt = makePrompt("email");
    expect(prompt).toContain("faithfully");
    expect(prompt).toContain("SOURCE ATTRIBUTION");
  });

  it("embeds the raw source text in the prompt between delimiters", () => {
    const prompt = makePrompt("outline");
    expect(prompt).toContain("Search engine optimisation (SEO)");
    expect(prompt).toContain("27 % of all clicks");
    expect(prompt).toContain("---");
  });

  it("includes the attribution in the prompt", () => {
    const prompt = makePrompt("x_thread");
    expect(prompt).toContain("https://example.com/seo-guide");
  });

  it("SEO blog article prompt targets 2,300–2,800 words and 6–8 H2 sections (Content Studio policy)", () => {
    const prompt = makePrompt("seo_blog_article");
    expect(prompt).toContain("2,300–2,800 words");
    expect(prompt).toContain("6–8 H2");
  });

  it("SEO blog article prompt does not use the short 800–1,200 word shortcut", () => {
    const prompt = makePrompt("seo_blog_article");
    // Must not contain the old short-form target range in any form.
    // Note: "800" appears legitimately inside "2,800" (the long-form upper
    // bound), so we check for the full short-form phrase rather than the
    // isolated digit, which would false-positive against "2,800".
    expect(prompt).not.toMatch(/\b800[–\-]1[, ]?200\b/);
    expect(prompt).not.toContain("800–1,200");
    expect(prompt).not.toContain("800-1,200");
    expect(prompt).not.toContain("1,200 words");
    expect(prompt).not.toContain("1 200 words");
  });

  it("SEO blog article prompt requires useful H3 sections", () => {
    const prompt = makePrompt("seo_blog_article");
    expect(prompt).toMatch(/H3/);
  });

  it("non-SEO formats do not use the long-form SEO word targets", () => {
    const nonSeoOutputs: RepurposeOutput[] = ["linkedin_post", "x_thread", "email", "faq", "outline"];
    for (const output of nonSeoOutputs) {
      const prompt = makePrompt(output);
      expect(prompt, `${output} should not contain SEO long-form target`).not.toContain("2,300–2,800");
    }
  });

  it("includes format-specific constraints for every non-SEO output", () => {
    const constraintSignals: Partial<Record<RepurposeOutput, string>> = {
      linkedin_post: "150",
      x_thread: "280 characters",
      email: "subject line",
      faq: "question-and-answer",
      outline: "sub-points",
    };
    for (const [output, signal] of Object.entries(constraintSignals) as [RepurposeOutput, string][]) {
      const prompt = makePrompt(output);
      expect(prompt, `Expected constraint signal for ${output}`).toContain(signal);
    }
  });
});

// ---------------------------------------------------------------------------
// 7. Anthropic request builder
// ---------------------------------------------------------------------------

describe("buildRepurposeAnthropicRequest", () => {
  it("uses DEFAULT_COPY_MODEL by default", () => {
    const request = buildRepurposeAnthropicRequest("test prompt");
    expect(request.model).toBe(DEFAULT_COPY_MODEL);
  });

  it("accepts a custom model override", () => {
    const request = buildRepurposeAnthropicRequest("test prompt", "claude-sonnet-4-6");
    expect(request.model).toBe("claude-sonnet-4-6");
  });

  it("uses JSON schema structured output with required title/bodyMarkdown/excerpt", () => {
    const request = buildRepurposeAnthropicRequest("test prompt");
    expect(request.output_config.format.type).toBe("json_schema");
    expect(request.output_config.format.schema.required).toEqual(
      expect.arrayContaining(["title", "bodyMarkdown", "excerpt"]),
    );
    expect(request.output_config.format.schema.additionalProperties).toBe(false);
  });

  it("uses max_tokens 9000 to accommodate SEO long-form output", () => {
    const request = buildRepurposeAnthropicRequest("test");
    expect(request.max_tokens).toBe(9000);
  });

  it("places the prompt as the single user message", () => {
    const request = buildRepurposeAnthropicRequest("my repurpose prompt");
    expect(request.messages).toHaveLength(1);
    expect(request.messages[0]).toEqual({ role: "user", content: "my repurpose prompt" });
  });
});

// ---------------------------------------------------------------------------
// 8. parseRepurposeResponse — valid input
// ---------------------------------------------------------------------------

describe("parseRepurposeResponse — valid input", () => {
  it("parses a well-formed JSON object", () => {
    const result = parseRepurposeResponse(
      {
        title: "SEO Basics for Founders",
        bodyMarkdown: "## Introduction\n\nSEO improves visibility.",
        excerpt: "A practical introduction to SEO for founder-led businesses.",
      },
      "seo_blog_article",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected ok");
    expect(result.draft.output).toBe("seo_blog_article");
    expect(result.draft.title).toBe("SEO Basics for Founders");
    expect(result.draft.bodyMarkdown).toContain("## Introduction");
    expect(result.draft.excerpt).toContain("practical introduction");
  });

  it("parses a valid JSON string (model returned raw text)", () => {
    const jsonString = JSON.stringify({
      title: "LinkedIn Growth Post",
      bodyMarkdown: "One insight drives reach.",
      excerpt: "A concise growth insight for LinkedIn.",
    });
    const result = parseRepurposeResponse(jsonString, "linkedin_post");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected ok");
    expect(result.draft.title).toBe("LinkedIn Growth Post");
  });

  it("strips markdown code fences before parsing", () => {
    const fenced = "```json\n{\"title\":\"Thread\",\"bodyMarkdown\":\"1/ Hook\",\"excerpt\":\"A thread.\"}\n```";
    const result = parseRepurposeResponse(fenced, "x_thread");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected ok");
    expect(result.draft.title).toBe("Thread");
  });
});

// ---------------------------------------------------------------------------
// 9. parseRepurposeResponse — malformed / truncated provider output
// ---------------------------------------------------------------------------

describe("parseRepurposeResponse — malformed / truncated output", () => {
  it("returns an error for non-JSON string", () => {
    const result = parseRepurposeResponse("This is not JSON at all.", "email");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected failure");
    expect(result.error).toMatch(/non-JSON/i);
  });

  it("returns an error for truncated JSON (incomplete string)", () => {
    const result = parseRepurposeResponse('{"title":"Truncated","bodyMarkdown":"Half', "faq");
    expect(result.ok).toBe(false);
  });

  it("returns an error when 'title' field is missing", () => {
    const result = parseRepurposeResponse(
      { bodyMarkdown: "Some body", excerpt: "Some excerpt" },
      "outline",
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected failure");
    expect(result.error).toContain("title");
  });

  it("returns an error when 'bodyMarkdown' field is missing", () => {
    const result = parseRepurposeResponse(
      { title: "A Title", excerpt: "An excerpt." },
      "seo_blog_article",
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected failure");
    expect(result.error).toContain("bodyMarkdown");
  });

  it("returns an error when 'excerpt' field is missing", () => {
    const result = parseRepurposeResponse(
      { title: "A Title", bodyMarkdown: "Body text." },
      "linkedin_post",
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected failure");
    expect(result.error).toContain("excerpt");
  });

  it("treats null as a malformed response", () => {
    const result = parseRepurposeResponse(null, "email");
    expect(result.ok).toBe(false);
  });

  it("treats an empty object as having missing fields", () => {
    const result = parseRepurposeResponse({}, "faq");
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 10. Size limits
// ---------------------------------------------------------------------------

describe("parseRepurposeResponse — size limits", () => {
  it(`truncates title beyond ${REPURPOSE_LIMITS.title} characters and appends ellipsis`, () => {
    const longTitle = "T".repeat(200);
    const result = parseRepurposeResponse(
      { title: longTitle, bodyMarkdown: "Body.", excerpt: "Short." },
      "seo_blog_article",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected ok");
    expect(result.draft.title.length).toBeLessThanOrEqual(REPURPOSE_LIMITS.title);
    expect(result.draft.title).toMatch(/…$/);
  });

  it(`truncates excerpt beyond ${REPURPOSE_LIMITS.excerpt} characters and appends ellipsis`, () => {
    const longExcerpt = "E".repeat(300);
    const result = parseRepurposeResponse(
      { title: "Title", bodyMarkdown: "Body.", excerpt: longExcerpt },
      "linkedin_post",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected ok");
    expect(result.draft.excerpt.length).toBeLessThanOrEqual(REPURPOSE_LIMITS.excerpt);
    expect(result.draft.excerpt).toMatch(/…$/);
  });

  it(`bodyMarkdown limit is large enough for a 3,000-word SEO article`, () => {
    // A 3,000-word article at ~6 chars/word plus spaces ≈ 21,000 chars.
    // The limit must be at least 21,000 to not truncate a legitimate SEO draft.
    expect(REPURPOSE_LIMITS.bodyMarkdown).toBeGreaterThanOrEqual(21_000);
  });

  it(`soft-truncates bodyMarkdown at the configured limit`, () => {
    const longBody = "w".repeat(REPURPOSE_LIMITS.bodyMarkdown + 5_000);
    const result = parseRepurposeResponse(
      { title: "Title", bodyMarkdown: longBody, excerpt: "Short." },
      "outline",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected ok");
    expect(result.draft.bodyMarkdown.length).toBeLessThanOrEqual(REPURPOSE_LIMITS.bodyMarkdown);
  });

  it("does not truncate a title that is exactly at the limit", () => {
    const exactTitle = "A".repeat(REPURPOSE_LIMITS.title);
    const result = parseRepurposeResponse(
      { title: exactTitle, bodyMarkdown: "Body.", excerpt: "Short." },
      "email",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected ok");
    expect(result.draft.title).toBe(exactTitle);
    expect(result.draft.title).not.toMatch(/…/);
  });
});

// ---------------------------------------------------------------------------
// 11. Handoff truthfulness
// ---------------------------------------------------------------------------

describe("handoff helpers", () => {
  it("only seo_blog_article can hand off to Content Studio", () => {
    expect(canHandOffToContentStudio("seo_blog_article")).toBe(true);
    expect(canHandOffToContentStudio("linkedin_post")).toBe(false);
    expect(canHandOffToContentStudio("x_thread")).toBe(false);
    expect(canHandOffToContentStudio("email")).toBe(false);
    expect(canHandOffToContentStudio("faq")).toBe(false);
    expect(canHandOffToContentStudio("outline")).toBe(false);
  });

  it("SEO output handoff label is 'Open in Content Studio'", () => {
    expect(repurposeHandoffLabel("seo_blog_article")).toBe("Open in Content Studio");
  });

  it("every non-SEO output handoff label is 'Keep as editable draft'", () => {
    const nonSeo: RepurposeOutput[] = ["linkedin_post", "x_thread", "email", "faq", "outline"];
    for (const output of nonSeo) {
      expect(repurposeHandoffLabel(output)).toBe("Keep as editable draft");
    }
  });

  it("does not use the old 'Send to Content Studio' or 'Copy or edit draft' strings", () => {
    const allOutputs: RepurposeOutput[] = [
      "seo_blog_article", "linkedin_post", "x_thread", "email", "faq", "outline",
    ];
    for (const output of allOutputs) {
      const label = repurposeHandoffLabel(output);
      expect(label).not.toBe("Send to Content Studio");
      expect(label).not.toBe("Copy or edit draft");
    }
  });
});

// ---------------------------------------------------------------------------
// 12. Safe parsing helpers
// ---------------------------------------------------------------------------

describe("safe parsing helpers", () => {
  it("safeRecord returns the object for a plain object", () => {
    expect(safeRecord({ a: 1 })).toEqual({ a: 1 });
  });

  it("safeRecord returns an empty object for non-objects", () => {
    expect(safeRecord(null)).toEqual({});
    expect(safeRecord(undefined)).toEqual({});
    expect(safeRecord("string")).toEqual({});
    expect(safeRecord([1, 2])).toEqual({});
    expect(safeRecord(42)).toEqual({});
  });

  it("safeString returns trimmed string or empty string", () => {
    expect(safeString("  hello  ")).toBe("hello");
    expect(safeString(null)).toBe("");
    expect(safeString(42)).toBe("");
    expect(safeString(undefined)).toBe("");
    expect(safeString({})).toBe("");
  });

  it("safeNumber returns the number or the fallback", () => {
    expect(safeNumber(42)).toBe(42);
    expect(safeNumber(0)).toBe(0);
    expect(safeNumber("hello")).toBe(0);
    expect(safeNumber(null, 7)).toBe(7);
    expect(safeNumber(Infinity, 5)).toBe(5);
    expect(safeNumber(NaN, 3)).toBe(3);
  });
});
