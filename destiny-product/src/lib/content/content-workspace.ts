export type ContentWorkspaceEmptyStateInput = {
  approvedKeywordCount: number;
  directDraft: boolean;
  rankedKeywordCount: number;
  savedDraftCount: number;
  selectedKeywordCount: number;
};

export type ContentWorkflowProgressInput = {
  directSource: "interview" | "repurpose" | null;
  generatedDraftCount: number;
  weeklyDraftCount: number;
};

function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export function contentWorkflowProgress(input: ContentWorkflowProgressInput) {
  if (input.directSource === "interview") return {
    detail: "Built from your exact interview answers",
    label: "Interview draft ready",
  };
  if (input.directSource === "repurpose") return {
    detail: "Loaded from your saved source",
    label: "Repurposed draft ready",
  };

  const generated = Math.max(0, Math.min(input.generatedDraftCount, input.weeklyDraftCount));
  const remaining = Math.max(0, input.weeklyDraftCount - generated);
  let label = `${plural(input.weeklyDraftCount, "topic")} ready to draft`;
  if (generated === input.weeklyDraftCount && generated > 0) label = `${plural(generated, "full draft")} ready`;
  else if (generated > 0) label = `${plural(generated, "full draft")} · ${plural(remaining, "topic")} ready`;

  return { detail: "Built from your keyword strategy", label };
}

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
