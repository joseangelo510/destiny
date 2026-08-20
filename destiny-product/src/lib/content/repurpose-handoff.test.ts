import { describe, expect, it } from "vitest";
import { buildRepurposeArticleDraft } from "./repurpose-handoff";

const READY_ROW = {
  id: "11111111-1111-4111-8111-111111111111",
  output_type: "seo_blog_article",
  target_keyword: "repurpose content",
  source_kind: "url",
  source_name: "Original guide",
  source_url: "https://example.com/guide",
  status: "ready",
  draft_title: "How to Repurpose Content Without Inventing Claims",
  draft_body: "# How to Repurpose Content\n\n## Start with the source\n\nKeep every claim traceable.",
  draft_metadata: {
    excerpt: "A practical guide to transforming existing work without fabricating evidence.",
    model: "test-model",
  },
};

describe("buildRepurposeArticleDraft", () => {
  it("maps a ready SEO record into an editable Content Studio draft", () => {
    const draft = buildRepurposeArticleDraft(READY_ROW);

    expect(draft).toMatchObject({
      keyword: "repurpose content",
      title: READY_ROW.draft_title,
      body: READY_ROW.draft_body,
      generationStatus: "needs_generation",
      generatedBy: "Repurpose · test-model",
    });
    expect(draft?.sources).toEqual([
      expect.objectContaining({
        title: "Original guide",
        url: "https://example.com/guide",
        publisher: "example.com",
      }),
    ]);
  });

  it("keeps approval fail-closed until normal Content Studio checks run", () => {
    const draft = buildRepurposeArticleDraft(READY_ROW);

    expect(draft?.titleCandidates).toEqual([]);
    expect(draft?.qualityIssues).toContainEqual(expect.objectContaining({
      code: "generation_required",
    }));
    expect(draft?.optimization.join(" ")).not.toMatch(/published|approved automatically/i);
  });

  it("uses the title as a bounded working keyword when none was selected", () => {
    const draft = buildRepurposeArticleDraft({
      ...READY_ROW,
      target_keyword: null,
      draft_title: "A".repeat(320),
    });

    expect(draft?.keyword).toHaveLength(300);
  });

  it.each([
    [{ ...READY_ROW, output_type: "email" }],
    [{ ...READY_ROW, status: "failed" }],
    [{ ...READY_ROW, draft_title: "" }],
    [{ ...READY_ROW, draft_body: null }],
    [null],
  ])("rejects records that are not ready SEO drafts", (row) => {
    expect(buildRepurposeArticleDraft(row)).toBeNull();
  });
});