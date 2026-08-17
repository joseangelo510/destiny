export const PUBLISHING_MODES = ["review_each", "batch_schedule", "automatic"] as const;
export type PublishingMode = typeof PUBLISHING_MODES[number];

export const PUBLISHING_STATES = ["planned", "drafting", "needs_review", "scheduled", "published", "failed", "managed_externally"] as const;
export type PublishingState = typeof PUBLISHING_STATES[number];

export type PublishingPlanRecord = {
  id: string;
  mode: PublishingMode;
  status: "active" | "paused" | "attention_needed";
  timezone: string;
  holdback_hours: number;
  start_date: string;
  end_date: string;
  confirmed_post_count: number;
  automatic_confirmed_at: string | null;
};

export type PublishingScheduleItemRecord = {
  id: string;
  plan_id: string;
  position: number;
  keyword: string;
  title: string;
  content_type: string;
  scheduled_for: string;
  state: PublishingState;
  review_recommended: boolean;
  remote_edit_url: string | null;
  remote_permalink: string | null;
  last_error: string | null;
};

export type PublishingPlanInput = {
  mode: PublishingMode;
  startDate: string;
  timezone: string;
  postCount: number;
  automaticConfirmed?: boolean;
};

export function reconcilePublishingItems(
  current: PublishingScheduleItemRecord[],
  refreshed: PublishingScheduleItemRecord[] | undefined,
) {
  return Array.isArray(refreshed) ? refreshed : current;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function validatePublishingPlan(input: PublishingPlanInput) {
  if (!PUBLISHING_MODES.includes(input.mode)) throw new Error("Choose how Destiny should handle publishing.");
  if (!DATE_PATTERN.test(input.startDate) || Number.isNaN(Date.parse(`${input.startDate}T12:00:00Z`))) throw new Error("Choose a valid start date.");
  if (!input.timezone.trim()) throw new Error("Choose a publishing timezone.");
  if (!Number.isInteger(input.postCount) || input.postCount < 1 || input.postCount > 12) throw new Error("Choose between 1 and 12 posts.");
  if (input.mode === "automatic" && input.automaticConfirmed !== true) {
    throw new Error("Confirm the automatic date range and post count before Destiny can schedule it.");
  }
  return input;
}

export function buildWeeklySchedule(startDate: string, postCount: number, publishHourUtc = 16) {
  if (!DATE_PATTERN.test(startDate)) throw new Error("Choose a valid start date.");
  if (!Number.isInteger(postCount) || postCount < 1 || postCount > 12) throw new Error("Choose between 1 and 12 posts.");
  const first = new Date(`${startDate}T${String(publishHourUtc).padStart(2, "0")}:00:00.000Z`);
  if (Number.isNaN(first.getTime())) throw new Error("Choose a valid start date.");
  return Array.from({ length: postCount }, (_, index) => new Date(first.getTime() + index * 7 * 24 * 60 * 60 * 1000).toISOString());
}

export function canScheduleArticle(input: {
  generated: boolean;
  qualityIssues: number;
  connected: boolean;
  scheduledFor: string;
  now?: string;
  holdbackHours?: number;
}) {
  if (!input.generated) return { allowed: false, reason: "Generate the complete article first." };
  if (input.qualityIssues > 0) return { allowed: false, reason: "The article needs review before scheduling." };
  if (!input.connected) return { allowed: false, reason: "Reconnect WordPress before scheduling." };
  const now = Date.parse(input.now ?? new Date().toISOString());
  const scheduled = Date.parse(input.scheduledFor);
  const holdback = (input.holdbackHours ?? 72) * 60 * 60 * 1000;
  if (Number.isNaN(scheduled) || scheduled - now < holdback) return { allowed: false, reason: "Choose a publication time at least 72 hours away." };
  return { allowed: true, reason: "" };
}

export function wordpressScheduleDate(scheduledFor: string, now = new Date().toISOString(), holdbackHours = 72) {
  const gate = canScheduleArticle({ generated: true, qualityIssues: 0, connected: true, scheduledFor, now, holdbackHours });
  if (!gate.allowed) throw new Error(gate.reason);
  return scheduledFor.replace(/\.\d{3}Z$/, "");
}

export function publishingItemKey(planId: string, keyword: string, position = 1) {
  return `${planId}:${position}:${keyword.normalize("NFKC").toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}`;
}

export function stateForMissedSchedule(scheduledFor: string, now = new Date().toISOString()): PublishingState {
  return Date.parse(scheduledFor) <= Date.parse(now) ? "needs_review" : "planned";
}
