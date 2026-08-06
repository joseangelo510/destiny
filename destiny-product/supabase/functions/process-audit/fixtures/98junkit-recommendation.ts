// Sanitized from completed DataForSEO audit b3fedeff-44ab-490b-9fa2-349c6b9c4fef.
// Contains only aggregate SEO metrics and provider issue codes used by the
// deterministic recommendation policy; no account or user data is included.
export const JUNKIT_RECOMMENDATION_FIXTURE = {
  input: {
    auditComplete: 1,
    criticalIssues: 0,
    warnings: 3,
    rankingKeywords: 17,
    newKeywords: 8,
    lostKeywords: 0,
    contentGaps: 2,
    reviewCount: 0,
    warningRenderBlocking: 1,
    unknownIssueCount: 2,
    planTier: 3 as const,
  },
  expected: {
    decisionCode: "publish_gap",
    growthStage: "build_search_coverage",
    weeklyQuest: "Make your homepage load faster for visitors",
    questSource: "issue_fix",
    issueQuestCode: "has_render_blocking_resources",
    issueDataQuality: "complete",
    questCategory: "technical",
    urgency: "focused",
    weeklyTaskManifest: ["keyword_review", "primary_quest", "content_review", "community_distribution", "social_distribution", "publisher_outreach", "directory_growth", "technical_review"],
    weeklyTaskApprovals: [true, false, true, false, false, true, false, false],
    weeklyTaskTiers: [1, 1, 1, 2, 2, 3, 3, 3],
    weeklyTaskPriorities: [1, 1, 1, 2, 2, 3, 3, 3],
  },
} as const;
