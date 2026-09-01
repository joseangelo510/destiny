import { describe, expect, it } from "vitest";
import { contentWorkspaceEmptyState } from "./content-workspace";

describe("content workspace access", () => {
  it("keeps saved drafts accessible after the strategy changes", () => {
    expect(contentWorkspaceEmptyState({ approvedKeywordCount: 0, directDraft: false, rankedKeywordCount: 12, savedDraftCount: 3, selectedKeywordCount: 0 })).toBeNull();
  });

  it("still blocks new content when no topic was approved and no draft exists", () => {
    expect(contentWorkspaceEmptyState({ approvedKeywordCount: 0, directDraft: false, rankedKeywordCount: 12, savedDraftCount: 0, selectedKeywordCount: 0 })?.title).toBe("Approve topics before creating content");
  });
});
