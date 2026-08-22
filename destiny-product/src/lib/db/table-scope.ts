export const SITE_SCOPED_TABLES = [
  "article_drafts",
  "audits",
  "competitors",
  "directory_profiles",
  "integrations",
  "interlink_opportunities",
  "interlink_runs",
  "interview_answers",
  "interview_questions",
  "interviews",
  "keyword_decisions",
  "keyword_preferences",
  "llm_visibility_tasks",
  "notification_preferences",
  "notifications",
  "publishing_plans",
  "publishing_schedule_items",
  "quests",
  "rank_digest_sends",
  "rank_observations",
  "rank_tracker_lists",
  "rank_tracker_runs",
  "reoptimization_documents",
  "repurpose_sources",
  "tracked_keywords",
  "voice_library_items",
] as const;

export const RELATION_SCOPED_TABLES = ["audit_metrics"] as const;
export const ORGANIZATION_SCOPED_TABLES = ["organization_members", "organizations", "websites"] as const;
export const USER_SCOPED_TABLES = ["profiles"] as const;
export const SERVICE_ROLE_ONLY_TABLES = ["cms_transfers"] as const;

export type SiteScopedTable = typeof SITE_SCOPED_TABLES[number];
export type OrganizationScopedTable = typeof ORGANIZATION_SCOPED_TABLES[number];
export type UserScopedTable = typeof USER_SCOPED_TABLES[number];
