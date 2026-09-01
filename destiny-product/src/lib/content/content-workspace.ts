export type ContentWorkspaceEmptyStateInput = {
  approvedKeywordCount: number;
  directDraft: boolean;
  rankedKeywordCount: number;
  savedDraftCount: number;
  selectedKeywordCount: number;
};

export function contentWorkspaceEmptyState(input: ContentWorkspaceEmptyStateInput) {
  if (input.directDraft || input.savedDraftCount > 0) return null;
  if (input.rankedKeywordCount < 1) return {
    title: "Keyword strategy is not ready",
    description: "Run an audit to populate the live search-intent opportunity pool.",
  };
  if (input.approvedKeywordCount < 1) return {
    title: "Approve topics before creating content",
    description: "Rebound SEO will not turn unapproved suggestions into drafts or a publishing schedule. Review Keyword strategy and approve the searches you want to use.",
  };
  if (input.selectedKeywordCount < 1) return {
    title: "Approve keywords to build the calendar",
    description: "Every reviewed keyword is currently declined. Return to Keyword strategy and approve the searches Rebound SEO should use.",
  };
  return null;
}
