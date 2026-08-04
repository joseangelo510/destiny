import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { buildArticleDraft, type ArticleDraft } from "../lib/content/article-draft";
import {
  ArticleEmptyState,
  ArticleReviewWorkspace,
  GenerationProgressPanel,
  applyCalendarCreateSelection,
  topicRailStatusLabel,
} from "./article-review-workspace";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const context = {
  businessName: "98junkit",
  problemSolved: "Fast junk removal",
  idealCustomer: "Homeowners clearing space",
  differentiation: "Same-day service",
  internalPages: [],
};

function starterDraft(keyword: string): ArticleDraft {
  return buildArticleDraft({ keyword, businessName: context.businessName, problemSolved: context.problemSolved, idealCustomer: context.idealCustomer, differentiation: context.differentiation });
}

function generatedDraft(keyword: string): ArticleDraft {
  return {
    ...starterDraft(keyword),
    title: "Commercial Junk Removal Services: The Complete Guide",
    body: "## What commercial junk removal costs\n\nA real generated paragraph about pricing.\n\n## How to prepare your site\n\nAnother real paragraph.\n",
    generationStatus: "generated",
    generatedBy: "claude-opus-4-8",
    sources: [{ id: "s1", title: "EPA disposal guidance", url: "https://example.com/epa", publisher: "EPA" }],
    qualityIssues: [],
  };
}

describe("ArticleReviewWorkspace before generation", () => {
  it("shows one calm empty state instead of an editable starter outline", () => {
    const html = renderToStaticMarkup(<ArticleReviewWorkspace auditId="a1" generationContext={context} initialDrafts={[starterDraft("commercial junk removal services")]} />);

    expect(html).toContain("Your article hasn&#x27;t been written yet.");
    expect(html).toContain("Set the direction above, and Destiny will research your topic and write the full 2,000–3,000 word draft. Nothing here is placeholder — what you approve is what you publish.");
    expect(html).toContain("Not written yet");
    expect(html).not.toContain("Starter outline ·");
    expect(html).not.toContain("Editable starter outline");
    // No pre-generation article fields: no SEO title input, meta descriptions, body editor, or word-count divider.
    expect(html).not.toContain("SEO title");
    expect(html).not.toContain("Meta description 1");
    expect(html).not.toContain("article-body-editor");
    expect(html).not.toContain("Search listing");
    expect(html).not.toContain("Download editable Word document");
    // Direction controls stay available.
    expect(html).toContain("Create the full article");
    expect(html).toContain("Special instructions");
    // The sidebar does not report a word count for writing that doesn't exist yet.
    expect(html).not.toMatch(/\d[\d,]* words/);
  });

  it("stays truthful when generation is not configured, without an outline fallback", () => {
    const html = renderToStaticMarkup(<ArticleReviewWorkspace auditId="a1" generationCapability={{ available: false, modelLabel: "claude-opus-4-8" }} generationContext={context} initialDrafts={[starterDraft("junk hauling")]} />);

    expect(html).toContain("Article generation is not configured");
    expect(html).toContain("Full-article generation is not configured in this environment.");
    expect(html).toContain("Your article hasn&#x27;t been written yet.");
    expect(html).not.toContain("starter outline");
    expect(html).not.toContain("article-body-editor");
  });
});

describe("ArticleReviewWorkspace while generating", () => {
  it("shows the staged progress panel with truthful timed labels and skeleton lines", () => {
    const html = renderToStaticMarkup(<GenerationProgressPanel stageIndex={2} />);

    expect(html).toContain("Researching your topic…");
    expect(html).toContain("Reading sources…");
    expect(html).toContain("Writing your draft…");
    expect(html).toContain("Polishing headings and metadata…");
    expect(html).toContain("article-skeleton");
    expect(html).toContain("class=\"done\"");
    expect(html).toContain("class=\"current\"");
    expect(html).toContain("usually takes a few minutes");
  });

  it("keeps the empty state copy separate from progress copy", () => {
    const html = renderToStaticMarkup(<ArticleEmptyState available />);
    expect(html).toContain("Your article hasn&#x27;t been written yet.");
    expect(html).not.toContain("Researching your topic…");
  });
});

describe("ArticleReviewWorkspace after generation", () => {
  it("reveals the fixed-height reading workspace with preview, header stats, and table of contents", () => {
    const html = renderToStaticMarkup(<ArticleReviewWorkspace auditId="a1" generationContext={context} initialDrafts={[generatedDraft("commercial junk removal services")]} />);

    expect(html).toContain("article-reading-pane");
    expect(html).toContain("Your article");
    expect(html).toContain("min read");
    expect(html).toContain(">Preview<");
    expect(html).toContain(">Edit<");
    expect(html).toContain(">Expand<");
    expect(html).toContain("In this article");
    expect(html).toContain("What commercial junk removal costs");
    expect(html).toContain("#article-how-to-prepare-your-site");
    // Default view is the rendered document, not the textarea.
    expect(html).toContain("article-preview-document");
    expect(html).not.toContain("article-body-editor");
    // Writing controls collapse to a one-line summary with Adjust.
    expect(html).toContain("Writing direction");
    expect(html).toContain(">Adjust<");
    expect(html).not.toContain("Create the full article");
    // Search listing group appears after generation.
    expect(html).toContain("Search listing");
    expect(html).toContain("SEO title");
    expect(html).toContain("Meta description 1");
    expect(html).toContain("Meta description 2");
    // Sources, download, and approval behavior stay intact.
    expect(html).toContain("Sources used");
    expect(html).toContain("EPA disposal guidance");
    expect(html).toContain("Download editable Word document");
    expect(html).toContain("Generate and review before approval"); // quality gate still holds for a short draft
    expect(html).toContain("Full draft");
  });

  it("renders the editorial calendar below the workspace with real-state actions and no auto-generation", () => {
    const calendar = [{
      month: 1, week: 1, contentType: "Service page", title: "Where to hire help for junk hauling", focusKeyword: "junk hauling",
      searchIntent: "conversion" as const, evidence: "Relevant site idea", searchVolume: 900, difficulty: 18, priorityReason: "Evidence-based opportunity",
    }];
    const html = renderToStaticMarkup(<ArticleReviewWorkspace auditId="a1" calendar={calendar} calendarSourceLabel="Saved audit data" generationContext={context} initialDrafts={[starterDraft("junk hauling")]} planMonths={3} />);

    expect(html).toContain("Editorial calendar");
    // The workspace draft for this keyword is a starter, so the row derives "Planned" + "Create content".
    expect(html).toContain("Create content");
    expect(html).not.toContain("Review draft");
    // Generation stays an explicit click in the writing workspace — the calendar action never renders a generate control.
    expect(html).toContain("Generate with Opus 4.8");
    expect(html.match(/Generate with Opus 4.8/g)).toHaveLength(1);
  });

  it("Create content prefills the row's title, appends without drift, and never clobbers a generated article", () => {
    const calendarRow = {
      month: 1, week: 2, contentType: "Pricing guide", title: "Office cleanouts: pricing, effort, and expected value", focusKeyword: "office cleanouts",
      searchIntent: "conversion" as const, evidence: "Relevant site idea", searchVolume: 700, difficulty: 15, priorityReason: "Evidence-based opportunity",
    };
    const weekly = { ...starterDraft("junk hauling"), approved: false };

    // New keyword: appends a prefilled starter and selects it.
    const appended = applyCalendarCreateSelection([weekly], calendarRow, context);
    expect(appended.drafts).toHaveLength(2);
    expect(appended.selectedIndex).toBe(1);
    expect(appended.drafts[1].keyword).toBe("office cleanouts");
    expect(appended.drafts[1].title).toBe(calendarRow.title);
    expect(appended.drafts[1].generationStatus).toBe("starter");

    // Rapid repeat click: idempotent, no duplicate draft, same selection.
    const repeated = applyCalendarCreateSelection(appended.drafts, calendarRow, context);
    expect(repeated.drafts).toHaveLength(2);
    expect(repeated.selectedIndex).toBe(1);

    // Existing weekly starter: syncs the calendar row's working title.
    const weeklyRow = { ...calendarRow, title: "Where to hire help for junk hauling", focusKeyword: "junk hauling" };
    const synced = applyCalendarCreateSelection([weekly], weeklyRow, context);
    expect(synced.selectedIndex).toBe(0);
    expect(synced.drafts[0].title).toBe("Where to hire help for junk hauling");

    // Generated article: selection only, the real title is never clobbered.
    const generated = { ...generatedDraft("junk hauling"), approved: false };
    const untouched = applyCalendarCreateSelection([generated], weeklyRow, context);
    expect(untouched.drafts).toBe(untouched.drafts);
    expect(untouched.drafts[0].title).toBe(generated.title);
    expect(untouched.selectedIndex).toBe(0);
  });

  it("labels a draft whose direction changed as needing regeneration", () => {
    expect(topicRailStatusLabel("needs_generation")).toBe("Regenerate with new settings");
    expect(topicRailStatusLabel("starter")).toBe("Not written yet");
    expect(topicRailStatusLabel("generated")).toBe("Full draft");
  });
});
