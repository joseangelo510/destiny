import { buildPublicationReceipt, type PublicationReceiptInput } from "@/lib/cms/publication-receipt";
import type { CalendarEvent, CalendarSummary, EvidenceKind } from "./contracts";
import type { ApprovedCalendarDraft } from "./calendar-scheduling";
import { reboundCustomerText } from "./brand";
import { buildDistributionOpportunityAction, distributionOpportunityFreshness, type DistributionOpportunityAction, type DistributionPlatform } from "./distribution-actions";

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalized(value: unknown) {
  return text(value).toLocaleLowerCase("en-US").replace(/\s+/g, " ");
}

function sentence(value: string) {
  return value ? `${value[0].toLocaleUpperCase("en-US")}${value.slice(1)}` : "Untitled item";
}

function keywordFromArticleKey(value: unknown) {
  const articleKey = text(value);
  const separator = articleKey.indexOf(":");
  return separator >= 0 ? articleKey.slice(separator + 1).trim() : articleKey;
}

export type ContentState = "idea" | "draft" | "approved" | "scheduled" | "published" | "verified_live";

export type ContentPipelineItem = {
  id: string;
  title: string;
  keyword: string;
  state: ContentState;
  detail: string;
  href: string;
  moveLabel: string;
  needsUser: boolean;
  evidenceKind: EvidenceKind | null;
};

const CONTENT_STATES: Array<{ state: ContentState; label: string }> = [
  { state: "idea", label: "Ideas" },
  { state: "draft", label: "Drafts" },
  { state: "approved", label: "Approved" },
  { state: "scheduled", label: "Scheduled" },
  { state: "published", label: "Published" },
  { state: "verified_live", label: "Verified live" },
];

const STATE_PRIORITY = Object.fromEntries(CONTENT_STATES.map((item, index) => [item.state, index])) as Record<ContentState, number>;

function contentMove(state: ContentState, id: string, source: "draft" | "schedule" | "other" = "other") {
  if (state === "idea") return { href: "/keywords", moveLabel: "Open strategy" };
  if (state === "approved" && source === "schedule") return { href: "/content#publishing-plan", moveLabel: "Review" };
  if (state === "draft" || state === "approved") return { href: id.startsWith("draft-") || id.includes("-") ? `/app/content/${id}` : "/content", moveLabel: "Review" };
  if (state === "scheduled") return { href: "/app/calendar", moveLabel: "Open calendar" };
  if (state === "published") return { href: "/content#publishing-plan", moveLabel: "View proof" };
  return { href: "/app/distribution", moveLabel: "Review reach" };
}

function scheduleState(value: string): ContentState {
  if (value === "published" || value === "published_unverified") return "published";
  if (value === "scheduled" || value === "managed_externally") return "scheduled";
  if (value === "needs_review") return "approved";
  return "idea";
}

function keepHighest(items: Map<string, ContentPipelineItem>, candidate: ContentPipelineItem) {
  const key = normalized(candidate.keyword || candidate.title);
  const current = items.get(key);
  if (!current || STATE_PRIORITY[candidate.state] >= STATE_PRIORITY[current.state]) items.set(key, candidate);
}

export function buildContentPipeline(input: {
  approvedKeywords: unknown[];
  drafts: unknown[];
  scheduleItems: unknown[];
  receipts: PublicationReceiptInput[];
}) {
  const items = new Map<string, ContentPipelineItem>();

  input.approvedKeywords.forEach((raw, index) => {
    const keyword = text(record(raw).keyword);
    if (!keyword) return;
    const id = `idea-${index}-${normalized(keyword).replaceAll(" ", "-")}`;
    const move = contentMove("idea", id);
    keepHighest(items, { id, title: sentence(keyword), keyword, state: "idea", detail: "Approved keyword · no saved draft yet", needsUser: false, evidenceKind: null, ...move });
  });

  input.drafts.forEach((raw, index) => {
    const row = record(raw);
    const draft = record(row.draft);
    const keyword = text(row.keyword) || text(draft.keyword);
    if (!keyword) return;
    const id = text(row.id) || `draft-${index}`;
    const state: ContentState = draft.approved === true ? "approved" : "draft";
    const title = text(draft.title) || sentence(keyword);
    const status = text(draft.generationStatus).replaceAll("_", " ") || "saved draft";
    keepHighest(items, { id, title, keyword, state, detail: state === "approved" ? `Approved · ${status}` : sentence(status), needsUser: state === "draft", evidenceKind: "reported", ...contentMove(state, id, "draft") });
  });

  input.scheduleItems.forEach((raw, index) => {
    const row = record(raw);
    const keyword = text(row.keyword);
    if (!keyword) return;
    const id = text(row.id) || `schedule-${index}`;
    const state = scheduleState(text(row.state));
    const when = text(row.scheduled_for);
    const detail = when ? `${sentence(text(row.state) || "planned")} · ${when}` : sentence(text(row.state) || "planned");
    keepHighest(items, { id, title: text(row.title) || sentence(keyword), keyword, state, detail, needsUser: text(row.state) === "needs_review", evidenceKind: "reported", ...contentMove(state, id, "schedule") });
  });

  input.receipts.forEach((raw, index) => {
    const receipt = buildPublicationReceipt(raw);
    const keyword = keywordFromArticleKey(receipt.articleKey);
    if (!keyword || (receipt.stage !== "live_verified" && receipt.stage !== "published_unverified")) return;
    const state: ContentState = receipt.stage === "live_verified" ? "verified_live" : "published";
    const id = `receipt-${index}-${normalized(keyword).replaceAll(" ", "-")}`;
    keepHighest(items, {
      id,
      title: sentence(keyword),
      keyword,
      state,
      detail: receipt.stage === "live_verified" ? "Crawler and CMS evidence complete" : "Published · verification pending",
      needsUser: false,
      evidenceKind: receipt.stage === "live_verified" ? "verified" : "reported",
      ...contentMove(state, id),
    });
  });

  const ordered = CONTENT_STATES.flatMap(({ state }) => [...items.values()].filter((item) => item.state === state).sort((a, b) => a.title.localeCompare(b.title)));
  const columns = CONTENT_STATES.map(({ state, label }) => ({ state, label, items: ordered.filter((item) => item.state === state) }));
  return {
    items: ordered,
    columns,
    stats: {
      done: ordered.filter((item) => item.state === "published" || item.state === "verified_live").length,
      needsUser: ordered.filter((item) => item.needsUser).length,
      verified: ordered.filter((item) => item.state === "verified_live").length,
      stuck: ordered.filter((item) => item.state === "published").length,
    },
  };
}

export type CalendarRow = {
  id: string;
  title: string;
  detail: string;
  state: string;
  href: string;
  moveLabel: string;
  overdue: boolean;
};

export function approvedCalendarDrafts(rows: unknown[], websiteId: string): ApprovedCalendarDraft[] {
  return rows.flatMap((raw): ApprovedCalendarDraft[] => {
    const row = record(raw);
    if (text(row.website_id) !== websiteId) return [];
    const draft = record(row.draft);
    const id = text(row.id);
    const keyword = text(row.keyword) || text(draft.keyword);
    const title = text(draft.title);
    if (!id || !keyword || !title || draft.approved !== true) return [];
    return [{ id, keyword, title }];
  });
}

export function derivedCalendarCadence(items: unknown[], timeZone: string) {
  const dates = items.map(record).map((item) => Date.parse(text(item.scheduled_for))).filter(Number.isFinite).sort((left, right) => left - right);
  if (dates.length < 2) return {
    label: "Not enough saved dates",
    detail: "Cadence will appear after at least two publishing dates are saved.",
    derived: true as const,
  };
  const day = 24 * 60 * 60 * 1000;
  const intervals = dates.slice(1).map((value, index) => Math.round((value - dates[index]) / day));
  const weekly = intervals.every((value) => value >= 6 && value <= 8);
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long", hour: "numeric", minute: "2-digit" });
  } catch {
    formatter = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", hour: "numeric", minute: "2-digit" });
  }
  const first = formatter.format(new Date(dates[0]));
  return {
    label: weekly ? "Weekly" : "Saved schedule",
    detail: weekly ? `${first} · derived from saved publishing dates.` : `${dates.length} saved dates · no editable workspace cadence is stored.`,
    derived: true as const,
  };
}

function calendarDateKey(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

export function calendarLocalDateKey(date: Date, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
    const key = `${part("year")}-${part("month")}-${part("day")}`;
    return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : date.toISOString().slice(0, 10);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function monthLabelFromDateKey(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

export function calendarMonthCells(events: CalendarEvent[], anchorDate?: string) {
  const requestedAnchor = anchorDate ? new Date(`${anchorDate}T12:00:00Z`) : null;
  const firstEvent = requestedAnchor && !Number.isNaN(requestedAnchor.getTime())
    ? requestedAnchor
    : events.map((event) => new Date(event.date)).find((date) => !Number.isNaN(date.getTime())) ?? new Date();
  const year = firstEvent.getUTCFullYear();
  const month = firstEvent.getUTCMonth();
  const first = new Date(Date.UTC(year, month, 1));
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  const start = new Date(first);
  start.setUTCDate(first.getUTCDate() - mondayOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);
    return { date, key, inMonth: date.getUTCMonth() === month, events: events.filter((event) => calendarDateKey(event.date) === key) };
  });
}

export function openCalendarDates(calendar: CalendarSummary) {
  return calendarMonthCells(calendar.events, calendar.anchorDate)
    .filter((cell) => cell.inMonth && !cell.events.length && (!calendar.anchorDate || cell.key >= calendar.anchorDate))
    .map((cell) => cell.key);
}

function scheduleItemIsOverdue(row: JsonRecord, now: Date) {
  const state = text(row.state);
  if (!["planned", "scheduled", "needs_review"].includes(state)) return false;
  const scheduledAt = Date.parse(text(row.scheduled_for));
  return Number.isFinite(scheduledAt) && scheduledAt < now.getTime();
}

export function buildCalendarView(input: { items: unknown[]; timeZone?: string; now?: Date }) {
  const now = input.now ?? new Date();
  const anchorDate = calendarLocalDateKey(now, input.timeZone ?? "UTC");
  const rows = input.items.flatMap((raw, index): CalendarRow[] => {
    const row = record(raw);
    const scheduledFor = text(row.scheduled_for);
    if (!scheduledFor) return [];
    const state = text(row.state) || "planned";
    const title = text(row.title) || sentence(text(row.keyword));
    const failed = state === "failed";
    const needsReview = state === "needs_review";
    const overdue = scheduleItemIsOverdue(row, now);
    return [{
      id: text(row.id) || `calendar-${index}`,
      title,
      detail: text(row.last_error) || scheduledFor,
      state,
      href: "/content#publishing-plan",
      moveLabel: overdue ? "Resolve overdue item" : needsReview ? "Review" : failed ? "Fix schedule" : "View schedule",
      overdue,
    }];
  });
  const events = rows.map((row) => ({
    id: row.id,
    date: row.detail.match(/^\d{4}-\d{2}-\d{2}/) ? row.detail : text(record(input.items.find((item) => text(record(item).id) === row.id)).scheduled_for),
    title: row.title,
    state: row.state,
    tone: row.state === "verified_live" ? "verified" as const : row.state === "needs_review" || row.state === "failed" ? "move" as const : "automatic" as const,
  }));
  const needs = rows.find((row) => row.state === "needs_review") ?? rows.find((row) => row.overdue);
  return {
    calendar: { month: monthLabelFromDateKey(anchorDate), anchorDate, events } satisfies CalendarSummary,
    cadence: derivedCalendarCadence(input.items, input.timeZone ?? "UTC"),
    rows,
    needsYou: needs ? { title: needs.title, detail: needs.overdue ? "This saved publishing item is overdue and needs a resolution." : "This saved publishing item needs your review.", href: needs.href, moveLabel: needs.moveLabel } : null,
    stats: {
      done: rows.filter((row) => row.state === "published" || row.state === "verified_live" || row.state === "managed_externally").length,
      needsUser: rows.filter((row) => row.state === "needs_review").length,
      scheduled: rows.filter((row) => (row.state === "scheduled" || row.state === "planned") && !row.overdue).length,
      stuck: rows.filter((row) => row.state === "failed" || row.overdue).length,
    },
  };
}

export type DistributionRow = {
  id: string;
  title: string;
  detail: string;
  kind: "opportunity" | "interlink";
  owner: "you" | "rebound" | "evidence";
  href: string;
  moveLabel: string;
  evidenceKind: EvidenceKind;
  action: DistributionOpportunityAction | null;
  freshness: { stale: boolean; label: string } | null;
};

export function buildDistributionView(input: { opportunities: unknown[]; interlinks: unknown[] }) {
  const opportunityRows = input.opportunities.flatMap((raw, index): DistributionRow[] => {
    const row = record(raw);
    const title = text(row.title);
    const url = text(row.url);
    if (!title) return [];
    const detail = text(row.snippet) || text(row.topic) || "Matched distribution opportunity";
    const action = buildDistributionOpportunityAction({ platform: row.platform, title: row.title, context: typeof row.snippet === "string" && row.snippet.trim() ? row.snippet : row.topic, url: row.url, checkedAt: row.checkedAt });
    const freshness = distributionOpportunityFreshness(typeof row.checkedAt === "string" ? row.checkedAt : null);
    const moveLabel = !action ? "Unavailable" : freshness.stale ? "Reverify in Distribution" : `Copy context & open ${action.platform}`;
    return [{ id: `opportunity-${index}`, title, detail, kind: "opportunity", owner: "you", href: action?.url ?? url, moveLabel, evidenceKind: "reported", action, freshness }];
  });
  const interlinkRows = input.interlinks.flatMap((raw, index): DistributionRow[] => {
    const row = record(raw);
    const source = text(row.source_title) || "Source page";
    const target = text(row.target_title) || "target page";
    const verified = text(row.status) === "verified" && Boolean(text(row.verified_at));
    return [{
      id: text(row.id) || `interlink-${index}`,
      title: `${source} → ${target}`,
      detail: verified ? "Crawler found the saved internal link." : "Internal-link evidence is not verified yet.",
      kind: "interlink",
      owner: verified ? "evidence" : "you",
      href: "/internal-links",
      moveLabel: verified ? "View evidence" : "Open interlinks",
      evidenceKind: verified ? "verified" : "reported",
      action: null,
      freshness: null,
    }];
  });
  const rows = [...opportunityRows, ...interlinkRows];
  const firstMove = opportunityRows.find((row) => row.action && !row.freshness?.stale) ?? interlinkRows.find((row) => row.owner === "you");
  const platformCounts = opportunityRows.reduce((counts, row) => {
    if (row.action) counts[row.action.platform] += 1;
    return counts;
  }, { Quora: 0, Reddit: 0 } as Record<DistributionPlatform, number>);
  return {
    rows,
    platformCounts,
    needsYou: firstMove ? { title: firstMove.title, detail: firstMove.detail, href: firstMove.kind === "opportunity" ? `#distribution-${firstMove.id}` : firstMove.href, moveLabel: firstMove.moveLabel } : null,
    stats: {
      ready: opportunityRows.filter((row) => row.action && !row.freshness?.stale).length,
      needsUser: opportunityRows.filter((row) => row.action && !row.freshness?.stale).length + interlinkRows.filter((row) => row.owner === "you").length,
      verified: rows.filter((row) => row.evidenceKind === "verified").length,
      stuck: interlinkRows.filter((row) => row.evidenceKind !== "verified").length + opportunityRows.filter((row) => !row.action || row.freshness?.stale).length,
    },
  };
}

export type ProgressItem = {
  id: string;
  title: string;
  detail: string;
  href: string;
  moveLabel: string;
  evidenceKind: EvidenceKind;
  at: string | null;
};

export function buildProgressView(input: { auditId?: string | null; quests: unknown[]; scheduleItems: unknown[]; receipts: PublicationReceiptInput[]; now?: Date }) {
  const now = input.now ?? new Date();
  const auditId = text(input.auditId);
  const quests = input.quests.map(record).filter((quest) => !auditId || text(quest.audit_id) === auditId);
  const scheduleRows = input.scheduleItems.map(record);
  const done = quests.filter((quest) => text(quest.status) === "complete").map((quest, index): ProgressItem => ({
    id: text(quest.id) || `done-${index}`,
    title: reboundCustomerText(text(quest.title) || "Completed move"),
    detail: reboundCustomerText(text(quest.description) || "Completed in the saved plan."),
    href: text(quest.action_path) || "/this-week",
    moveLabel: "View",
    evidenceKind: text(quest.verification_status) === "verified" ? "verified" : "reported",
    at: text(quest.completed_at) || null,
  })).sort((a, b) => (b.at || "").localeCompare(a.at || ""));
  const you = quests.filter((quest) => !new Set(["complete", "skipped"]).has(text(quest.status))).map((quest, index): ProgressItem => ({
    id: text(quest.id) || `open-${index}`,
    title: reboundCustomerText(text(quest.title) || "Open move"),
    detail: reboundCustomerText(text(quest.description) || "Ready in your plan."),
    href: text(quest.action_path) || "/this-week",
    moveLabel: "Open",
    evidenceKind: "reported",
    at: null,
  }));
  const rebound = scheduleRows.filter((row) => ["planned", "scheduled", "managed_externally"].includes(text(row.state)) && !scheduleItemIsOverdue(row, now)).map((row, index): ProgressItem => ({
    id: text(row.id) || `rebound-${index}`,
    title: text(row.title) || sentence(text(row.keyword)),
    detail: text(row.scheduled_for) || "Saved publishing plan",
    href: "/app/calendar",
    moveLabel: "Open calendar",
    evidenceKind: "reported",
    at: text(row.scheduled_for) || null,
  }));
  const google = input.receipts.flatMap((raw, index): ProgressItem[] => {
    const receipt = buildPublicationReceipt(raw);
    if (receipt.stage !== "published_unverified") return [];
    const keyword = keywordFromArticleKey(receipt.articleKey);
    return [{ id: `google-${index}`, title: sentence(keyword), detail: "Published and waiting on complete public verification.", href: "/content#publishing-plan", moveLabel: "View proof", evidenceKind: "reported", at: null }];
  });
  const blockers = [
    ...quests.filter((quest) => text(quest.guidance_state) === "blocked").map((quest, index): ProgressItem => ({ id: text(quest.id) || `blocker-${index}`, title: reboundCustomerText(text(quest.title) || "Blocked move"), detail: reboundCustomerText(text(quest.blocker_reason) || "This move is blocked in the saved plan."), href: text(quest.action_path) || "/this-week", moveLabel: "Open", evidenceKind: "reported", at: null })),
    ...scheduleRows.filter((row) => text(row.state) === "failed").map((row, index): ProgressItem => ({ id: text(row.id) || `schedule-blocker-${index}`, title: text(row.title) || sentence(text(row.keyword)), detail: text(row.last_error) || "The saved publishing item failed.", href: "/content#publishing-plan", moveLabel: "Fix schedule", evidenceKind: "reported", at: null })),
    ...scheduleRows.filter((row) => scheduleItemIsOverdue(row, now)).map((row, index): ProgressItem => ({ id: text(row.id) || `overdue-schedule-${index}`, title: text(row.title) || sentence(text(row.keyword)), detail: `This saved publishing item is overdue from ${text(row.scheduled_for)} without a completed publishing state.`, href: "/content#publishing-plan", moveLabel: "Resolve schedule", evidenceKind: "reported", at: text(row.scheduled_for) || null })),
  ];
  return {
    done,
    owners: { you, rebound, google },
    blockers,
    needsYou: you[0] ?? blockers[0] ?? null,
    milestones: [
      { label: "Completed moves", value: done.length, total: quests.length },
      { label: "Verified moves", value: done.filter((item) => item.evidenceKind === "verified").length, total: done.length },
      { label: "Scheduled pieces", value: rebound.length, total: input.scheduleItems.length },
      { label: "Pages awaiting Google", value: google.length, total: input.receipts.length },
    ],
    stats: { done: done.length, needsUser: you.length, inMotion: rebound.length + google.length, stuck: blockers.length },
  };
}
