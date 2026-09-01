import { beforeEach, describe, expect, it, vi } from "vitest";

const { currentArticleQualityIssues } = vi.hoisted(() => ({
  currentArticleQualityIssues: vi.fn(),
}));

vi.mock("@/lib/content/article-draft", () => ({ currentArticleQualityIssues }));

import { approvalGate, saveDraftApproval, toggleDraftApproval } from "./draft-approval";

const draft = {
  keyword: "kiln repair",
  title: "Kiln repair guide",
  body: "# Kiln repair guide\n\nSaved body",
  generationStatus: "generated",
  generatedBy: "claude",
  metaTitle: "Kiln repair guide",
  titleCandidates: [{ headline: "One" }],
  metaDescriptions: ["A saved description."],
  bucketBrigades: [],
  sources: [],
  infographics: [],
  preferences: { format: "seo_article" },
  customEvidence: { keep: "exactly" },
  approved: false,
};

describe("Rebound draft approval", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentArticleQualityIssues.mockResolvedValue([]);
  });

  it("blocks approval before generation without invoking the quality validator", async () => {
    await expect(approvalGate({ ...draft, generationStatus: "needs_generation" })).resolves.toMatchObject({
      canApprove: false,
      issues: [expect.objectContaining({ code: "generation_required" })],
    });
    expect(currentArticleQualityIssues).not.toHaveBeenCalled();
  });

  it("reuses the canonical quality validator and blocks every reported issue", async () => {
    currentArticleQualityIssues.mockResolvedValue([{ code: "word_count", message: "Add more useful depth." }]);

    await expect(approvalGate(draft)).resolves.toEqual({
      canApprove: false,
      issues: [{ code: "word_count", message: "Add more useful depth." }],
    });
    expect(currentArticleQualityIssues).toHaveBeenCalledWith(draft);
  });

  it("allows a generated draft only when the canonical validator is clear", async () => {
    await expect(approvalGate(draft)).resolves.toEqual({ canApprove: true, issues: [] });
  });

  it("toggles only approved and preserves the full stored draft losslessly", () => {
    const next = toggleDraftApproval(draft, true);

    expect(next).toEqual({ ...draft, approved: true });
    expect(next.customEvidence).toBe(draft.customEvidence);
  });

  it("persists exactly one full draft through the existing scoped PUT contract", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ saved: 1 }), { status: 200 }));

    const next = await saveDraftApproval({
      auditId: "11111111-1111-4111-8111-111111111111",
      approved: true,
      draft,
      fetcher,
      websiteId: "831740e7-b8f7-4612-8fe4-794219031191",
    });

    expect(next).toEqual({ ...draft, approved: true });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/content/drafts");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(String(init.body))).toEqual({
      websiteId: "831740e7-b8f7-4612-8fe4-794219031191",
      auditId: "11111111-1111-4111-8111-111111111111",
      drafts: [{ ...draft, approved: true }],
    });
  });

  it("reopens through the same one-draft PUT without changing any other field", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ saved: 1 }), { status: 200 }));

    const next = await saveDraftApproval({
      auditId: "11111111-1111-4111-8111-111111111111",
      approved: false,
      draft: { ...draft, approved: true },
      fetcher,
      websiteId: "831740e7-b8f7-4612-8fe4-794219031191",
    });

    expect(next).toEqual({ ...draft, approved: false });
    const [, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body)).drafts).toEqual([{ ...draft, approved: false }]);
  });

  it("surfaces persistence failures instead of claiming an optimistic state", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Save failed." }), { status: 500 }));

    await expect(saveDraftApproval({
      auditId: "11111111-1111-4111-8111-111111111111",
      approved: true,
      draft,
      fetcher,
      websiteId: "831740e7-b8f7-4612-8fe4-794219031191",
    })).rejects.toThrow("Save failed.");
  });
});
