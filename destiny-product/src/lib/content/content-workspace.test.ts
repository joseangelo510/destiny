import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contentWorkflowProgress, contentWorkspaceEmptyState } from "./content-workspace";

describe("content workspace access", () => {
  it("keeps saved drafts accessible after the strategy changes", () => {
    expect(contentWorkspaceEmptyState({ approvedKeywordCount: 0, directDraft: false, rankedKeywordCount: 12, savedDraftCount: 3, selectedKeywordCount: 0 })).toBeNull();
  });

  it("still blocks new content when no topic was approved and no draft exists", () => {
    expect(contentWorkspaceEmptyState({ approvedKeywordCount: 0, directDraft: false, rankedKeywordCount: 12, savedDraftCount: 0, selectedKeywordCount: 0 })?.title).toBe("Approve topics before creating content");
  });

  it("describes mixed weekly content without claiming outlines exist", () => {
    expect(contentWorkflowProgress({ directSource: null, generatedDraftCount: 1, weeklyDraftCount: 3 })).toEqual({
      detail: "Built from your keyword strategy",
      label: "1 full draft · 2 topics ready",
    });
  });

  it("describes generated and starter-only weekly sets truthfully", () => {
    expect(contentWorkflowProgress({ directSource: null, generatedDraftCount: 3, weeklyDraftCount: 3 }).label).toBe("3 full drafts ready");
    expect(contentWorkflowProgress({ directSource: null, generatedDraftCount: 0, weeklyDraftCount: 3 }).label).toBe("3 topics ready to draft");
  });

  it("keeps direct draft provenance in the workflow label", () => {
    expect(contentWorkflowProgress({ directSource: "interview", generatedDraftCount: 1, weeklyDraftCount: 1 })).toEqual({
      detail: "Built from your exact interview answers",
      label: "Interview draft ready",
    });
    expect(contentWorkflowProgress({ directSource: "repurpose", generatedDraftCount: 1, weeklyDraftCount: 1 })).toEqual({
      detail: "Loaded from your saved source",
      label: "Repurposed draft ready",
    });
  });

  it("uses one current-audit saved-draft definition across the pipeline", () => {
    const contentPage = readFileSync(new URL("../../app/content/page.tsx", import.meta.url), "utf8");
    const keywordPage = readFileSync(new URL("../../app/keywords/page.tsx", import.meta.url), "utf8");
    const rankTrackerPage = readFileSync(new URL("../../app/rank-tracker/page.tsx", import.meta.url), "utf8");

    expect(contentPage).toContain("contentDrafts={savedArticleDraftRows?.length ?? 0}");
    expect(contentPage).not.toContain("contentDrafts={generatedArticleCount}");
    expect(keywordPage).toContain('.eq("audit_id", context.audit.id)');
    expect(rankTrackerPage).toContain('.eq("audit_id", context.audit.id)');
  });
});
