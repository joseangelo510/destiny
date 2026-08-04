// Sanitized task-state fixture from completed audit c9021b50-ba99-43ec-b4c0-04f4c50e939a.
// It contains no account, business, or user identifiers beyond the audit UUID.
const createdAt = "2026-08-02T03:53:08.268Z";

export const REAL_USER_ZERO_HISTORY = [
  ["primary_quest", "complete", "2026-08-02T03:53:48.537Z"],
  ["content_review", "complete", "2026-08-02T03:55:18.760Z"],
  ["business_confirmation", "complete", "2026-08-02T03:53:33.114Z"],
  ["distribution", "todo", null],
  ["keyword_review", "todo", null],
  ["reviews", "todo", null],
  ["distribution", "todo", null],
  ["technical_review", "todo", null],
].map(([taskType, status, completedAt]) => ({
  audit_id: "c9021b50-ba99-43ec-b4c0-04f4c50e939a",
  week_number: 1,
  task_type: taskType as string,
  status: status as string,
  completed_at: completedAt as string | null,
  created_at: createdAt,
}));
