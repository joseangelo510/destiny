import { buildPublicationReceipt, type PublicationReceiptInput } from "@/lib/cms/publication-receipt";
import type { CalendarSummary, EvidenceKind } from "./contracts";

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

function contentMove(state: ContentState, id: string) {
  if (state === "idea") return { href: "/keywords", moveLabel: "Open strategy" };
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
    keepHighest(items, { id, title: sentence(keyword), keyword, state: "idea", detail: "Approved keyword · no saved draft yet", evidenceKind: null, ...move });
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
    keepHighest(items, { id, title, keyword, state, detail: state === "approved" ? `Approved · ${status}` : sentence(status), evidenceKind: "reported", ...contentMove(state, id) });
  });

  input.scheduleItems.forEach((raw, index) => {
    const row = record(raw);
    const keyword = text(row.keyword);
    if (!keyword) return;
    const id = text(row.id) || `schedule-${index}`;
    const state = scheduleState(text(row.state));
    const when = text(row.scheduled_for);
    const detail = when ? `${sentence(text(row.state) || "planned")} · ${when}` : sentence(text(row.state) || "planned");
    keepHighest(items, { id, title: text(row.title) || sentence(keyword), keyword, state, detail, evidenceKind: "reported", ...contentMove(state, id) });
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
      needsUser: ordered.filter((item) => item.state === "draft").length,
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
};

export function buildCalendarView(input: { month: string; items: unknown[] }) {
  const rows = input.items.flatMap((raw, index): CalendarRow[] => {
    const row = record(raw);
    const scheduledFor = text(row.scheduled_for);
    if (!scheduledFor) return [];
    const state = text(row.state) || "planned";
    const title = text(row.title) || sentence(text(row.keyword));
    const failed = state === "failed";
    const needsReview = state === "needs_review";
    return [{
      id: text(row.id) || `calendar-${index}`,
      title,
      detail: text(row.last_error) || scheduledFor,
      state,
      href: "/content#publishing-plan",
      moveLabel: needsReview ? "Review" : failed ? "Fix schedule" : "View schedule",
    }];
  });
  const events = rows.map((row) => ({
    id: row.id,
    date: row.detail.match(/^\d{4}-\d{2}-\d{2}/) ? row.detail : text(record(input.items.find((item) => text(record(item).id) === row.id)).scheduled_for),
    title: row.title,
    state: row.state,
    tone: row.state === "verified_live" ? "verified" as const : row.state === "needs_review" || row.state === "failed" ? "move" as const : "automatic" as const,
  }));
  const needs = rows.find((row) => row.state === "needs_review");
  return {
    calendar: { month: input.month, events } satisfies CalendarSummary,
    rows,
    needsYou: needs ? { title: needs.title, detail: "This saved publishing item needs your review.", href: needs.href, moveLabel: needs.moveLabel } : null,
    stats: {
      done: rows.filter((row) => row.state === "published" || row.state === "verified_live" || row.state === "managed_externally").length,
      needsUser: rows.filter((row) => row.state === "needs_review").length,
      scheduled: rows.filter((row) => row.state === "scheduled" || row.state === "planned").length,
      stuck: rows.filter((row) => row.state === "failed").length,
    },
  };
}

export type DistributionRow = {
  id: string;
  title: string;
  detail: string;
  owner: "you" | "rebound" | "evidence";
  href: string;
  moveLabel: string;
  evidenceKind: EvidenceKind;
};

export function buildDistributionView(input: { opportunities: unknown[]; interlinks: unknown[] }) {
  const opportunityRows = input.opportunities.flatMap((raw, index): DistributionRow[] => {
    const row = record(raw);
    const title = text(row.title);
    const url = text(row.url);
    if (!title || !url) return [];
    const platform = text(row.platform) || "Community";
    return [{ id: `opportunity-${index}`, title, detail: text(row.snippet) || text(row.topic) || "Matched distribution opportunity", owner: "you", href: url, moveLabel: `Open ${platform}`, evidenceKind: "reported" }];
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
      owner: verified ? "evidence" : "you",
      href: "/internal-links",
      moveLabel: verified ? "View evidence" : "Open interlinks",
      evidenceKind: verified ? "verified" : "reported",
    }];
  });
  const rows = [...opportunityRows, ...interlinkRows];
  const firstMove = rows.find((row) => row.owner === "you");
  return {
    rows,
    needsYou: firstMove ? { title: firstMove.title, detail: firstMove.detail, href: firstMove.href, moveLabel: firstMove.moveLabel } : null,
    stats: {
      ready: opportunityRows.length,
      needsUser: rows.filter((row) => row.owner === "you").length,
      verified: rows.filter((row) => row.evidenceKind === "verified").length,
      stuck: interlinkRows.filter((row) => row.evidenceKind !== "verified").length,
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

export function buildProgressView(input: { quests: unknown[]; scheduleItems: unknown[]; receipts: PublicationReceiptInput[] }) {
  const quests = input.quests.map(record);
  const done = quests.filter((quest) => text(quest.status) === "complete").map((quest, index): ProgressItem => ({
    id: text(quest.id) || `done-${index}`,
    title: text(quest.title) || "Completed move",
    detail: text(quest.description) || "Completed in the saved plan.",
    href: text(quest.action_path) || "/this-week",
    moveLabel: "View",
    evidenceKind: text(quest.verification_status) === "verified" ? "verified" : "reported",
    at: text(quest.completed_at) || null,
  })).sort((a, b) => (b.at || "").localeCompare(a.at || ""));
  const you = quests.filter((quest) => !new Set(["complete", "skipped"]).has(text(quest.status))).map((quest, index): ProgressItem => ({
    id: text(quest.id) || `open-${index}`,
    title: text(quest.title) || "Open move",
    detail: text(quest.description) || "Ready in your plan.",
    href: text(quest.action_path) || "/this-week",
    moveLabel: "Open",
    evidenceKind: "reported",
    at: null,
  }));
  const rebound = input.scheduleItems.map(record).filter((row) => ["planned", "scheduled", "managed_externally"].includes(text(row.state))).map((row, index): ProgressItem => ({
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
    ...quests.filter((quest) => text(quest.guidance_state) === "blocked").map((quest, index): ProgressItem => ({ id: text(quest.id) || `blocker-${index}`, title: text(quest.title) || "Blocked move", detail: text(quest.blocker_reason) || "This move is blocked in the saved plan.", href: text(quest.action_path) || "/this-week", moveLabel: "Open", evidenceKind: "reported", at: null })),
    ...input.scheduleItems.map(record).filter((row) => text(row.state) === "failed").map((row, index): ProgressItem => ({ id: text(row.id) || `schedule-blocker-${index}`, title: text(row.title) || sentence(text(row.keyword)), detail: text(row.last_error) || "The saved publishing item failed.", href: "/content#publishing-plan", moveLabel: "Fix schedule", evidenceKind: "reported", at: null })),
  ];
  return {
    done,
    owners: { you, rebound, google },
    blockers,
    needsYou: you[0] ?? null,
    milestones: [
      { label: "Completed moves", value: done.length, total: quests.length },
      { label: "Verified moves", value: done.filter((item) => item.evidenceKind === "verified").length, total: done.length },
      { label: "Scheduled pieces", value: rebound.length, total: input.scheduleItems.length },
      { label: "Pages awaiting Google", value: google.length, total: input.receipts.length },
    ],
    stats: { done: done.length, needsUser: you.length, inMotion: rebound.length + google.length, stuck: blockers.length },
  };
}
