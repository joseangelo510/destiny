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
  related_article_title?: string | null;
  scheduled_for: string;
  state: PublishingState;
  review_recommended: boolean;
  remote_id: string | null;
  remote_edit_url: string | null;
  remote_permalink: string | null;
  last_error: string | null;
};

export type EditorialContentChannel = "article" | "linkedin" | "x" | "approved_draft";

export function editorialContentChannel(contentType: string | null | undefined): EditorialContentChannel {
  const normalized = (contentType ?? "").trim().toLocaleLowerCase();
  if (normalized.includes("linkedin")) return "linkedin";
  if (normalized === "x post" || normalized.includes("twitter")) return "x";
  if (normalized.includes("approved draft")) return "approved_draft";
  return "article";
}

export function isArticleCalendarItem(item: Pick<PublishingScheduleItemRecord, "content_type" | "position">, confirmedPostCount: number) {
  return item.position <= confirmedPostCount && editorialContentChannel(item.content_type) === "article";
}

export type PublishingCalendarState = "planned" | "needs_review" | "scheduled" | "published" | "failed" | "missed" | "manual";
export type PublishingDeliveryMode = "direct_wordpress" | "manual_webflow" | "manual_wix" | "unavailable";

export function publishingDeliveryMode(websitePlatform: string | null, connectedProviders: Iterable<string>): PublishingDeliveryMode {
  const connected = new Set(connectedProviders);
  if (connected.has("wordpress")) return "direct_wordpress";
  if (connected.has("webflow")) return "manual_webflow";
  if (websitePlatform === "wix") return "manual_wix";
  return "unavailable";
}

export function publishingCalendarState(item: PublishingScheduleItemRecord, websitePlatform: string | null): PublishingCalendarState {
  if (websitePlatform === "wix" && ["article", "approved_draft"].includes(editorialContentChannel(item.content_type))) return "manual";
  if (item.state === "managed_externally") return "manual";
  if (item.state === "published") return item.remote_permalink ? "published" : "planned";
  if (item.state === "scheduled") return item.remote_id ? "scheduled" : "planned";
  if (item.state === "failed") return "failed";
  if (item.state === "needs_review") return /missed|date passed|past due/i.test(item.last_error ?? "") ? "missed" : "needs_review";
  return "planned";
}

export function wordpressRemoteIdFromEditUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const id = new URL(value).searchParams.get("post");
    return id && /^\d+$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

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

function normalizedKeyword(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function localDateTimeAsUtc(startDate: string, timeZone: string, localHour: number, localMinute = 0) {
  const [year, month, day] = startDate.split("-").map(Number);
  const localWallClockAsUtc = Date.UTC(year, month - 1, day, localHour, localMinute, 0);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const offsetAt = (instant: number) => {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(instant))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]));
    return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - instant;
  };
  const firstPass = localWallClockAsUtc - offsetAt(localWallClockAsUtc);
  return new Date(localWallClockAsUtc - offsetAt(firstPass));
}

export function calendarLocalDateTimeAsUtc(value: string, timeZone: string) {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("Choose a valid publishing date and time.");
  try { new Intl.DateTimeFormat("en-US", { timeZone }).format(); }
  catch { throw new Error("Choose a valid publishing timezone."); }
  const hour = Number(match[2]);
  const minute = Number(match[3]);
  if (hour > 23 || minute > 59) throw new Error("Choose a valid publishing date and time.");
  return localDateTimeAsUtc(match[1], timeZone, hour, minute).toISOString();
}

export function buildWeeklySchedule(startDate: string, postCount: number, timeZone = "UTC", publishHourLocal = 9) {
  if (!DATE_PATTERN.test(startDate)) throw new Error("Choose a valid start date.");
  if (!Number.isInteger(postCount) || postCount < 1 || postCount > 12) throw new Error("Choose between 1 and 12 posts.");
  if (!Number.isInteger(publishHourLocal) || publishHourLocal < 0 || publishHourLocal > 23) throw new Error("Choose a valid publication hour.");
  try { new Intl.DateTimeFormat("en-US", { timeZone }).format(); }
  catch { throw new Error("Choose a valid publishing timezone."); }
  const firstCalendarDate = new Date(`${startDate}T12:00:00.000Z`);
  if (Number.isNaN(firstCalendarDate.getTime())) throw new Error("Choose a valid start date.");
  return Array.from({ length: postCount }, (_, index) => {
    const calendarDate = new Date(firstCalendarDate.getTime() + index * 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    return localDateTimeAsUtc(calendarDate, timeZone, publishHourLocal).toISOString();
  });
}

export function unapprovedCalendarKeywords(calendar: Array<{ keyword: string }>, approvedKeywords: string[]) {
  const approved = new Set(approvedKeywords.map(normalizedKeyword));
  return [...new Set(calendar.filter((item) => !approved.has(normalizedKeyword(item.keyword))).map((item) => item.keyword))];
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
