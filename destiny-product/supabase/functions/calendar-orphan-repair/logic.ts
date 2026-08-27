export type CalendarRepairItem = {
  id: string;
  websiteId: string;
  auditId: string;
  keyword: string;
  normalizedKeyword: string;
  title: string;
  state: string;
  articleKey: string | null;
  remoteId: string | null;
  remotePermalink: string | null;
};

export type CalendarRepairDraft = {
  id: string;
  websiteId: string;
  auditId: string;
  keyword: string;
  title: string;
};

export type CalendarRepairTransfer = {
  id: string;
  websiteId: string;
  articleKey: string;
  publicationStatus: string;
  remoteId: string | null;
  remotePermalink: string | null;
};

export type CalendarRepairInput = {
  websiteId: string;
  requestedItemId: string;
  items: CalendarRepairItem[];
  drafts: CalendarRepairDraft[];
  transfers: CalendarRepairTransfer[];
};

export type CalendarRepairMatch = {
  itemId: string;
  transferId: string;
  draftId: string;
  websiteId: string;
  auditId: string;
  normalizedKeyword: string;
  title: string;
  articleKey: string;
  remoteId: string;
  remotePermalink: string;
};

export type CalendarRepairResult =
  | { status: "ready"; match: CalendarRepairMatch }
  | { status: "already_repaired"; match: CalendarRepairMatch }
  | { status: "ambiguous"; reason: "multiple_items" | "multiple_drafts" | "multiple_transfers" }
  | { status: "no_match"; reason: "item_not_found" | "item_not_orphan" | "draft_not_found" | "transfer_not_found" | "transfer_incomplete" };

export function normalizedKeyword(value: string) {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function exactTitle(value: string) {
  return value.trim();
}

function isOrphan(item: CalendarRepairItem) {
  return item.state === "needs_review"
    && item.articleKey === null
    && item.remoteId === null
    && item.remotePermalink === null;
}

function completeMatch(
  item: CalendarRepairItem,
  draft: CalendarRepairDraft,
  transfer: CalendarRepairTransfer,
): CalendarRepairMatch | null {
  const remoteId = transfer.remoteId?.trim() ?? "";
  const remotePermalink = transfer.remotePermalink?.trim() ?? "";
  if (!remoteId || !remotePermalink) return null;
  return {
    itemId: item.id,
    transferId: transfer.id,
    draftId: draft.id,
    websiteId: item.websiteId,
    auditId: item.auditId,
    normalizedKeyword: normalizedKeyword(item.normalizedKeyword || item.keyword),
    title: exactTitle(item.title),
    articleKey: transfer.articleKey,
    remoteId,
    remotePermalink,
  };
}

export function selectCalendarRepair(input: CalendarRepairInput): CalendarRepairResult {
  const requested = input.items.find((item) => item.id === input.requestedItemId && item.websiteId === input.websiteId);
  if (!requested) return { status: "no_match", reason: "item_not_found" };

  const keyword = normalizedKeyword(requested.normalizedKeyword || requested.keyword);
  const title = exactTitle(requested.title);
  const articleKey = `${requested.auditId}:${keyword}`;
  const drafts = input.drafts.filter((draft) => (
    draft.websiteId === input.websiteId
    && draft.auditId === requested.auditId
    && normalizedKeyword(draft.keyword) === keyword
    && exactTitle(draft.title) === title
  ));
  if (drafts.length === 0) return { status: "no_match", reason: "draft_not_found" };
  if (drafts.length > 1) return { status: "ambiguous", reason: "multiple_drafts" };

  const transfers = input.transfers.filter((transfer) => (
    transfer.websiteId === input.websiteId
    && transfer.articleKey === articleKey
    && transfer.publicationStatus === "verified_live"
  ));
  if (transfers.length === 0) return { status: "no_match", reason: "transfer_not_found" };
  if (transfers.length > 1) return { status: "ambiguous", reason: "multiple_transfers" };

  const match = completeMatch(requested, drafts[0], transfers[0]);
  if (!match) return { status: "no_match", reason: "transfer_incomplete" };

  const alreadyRepaired = requested.state === "published"
    && requested.articleKey === match.articleKey
    && requested.remoteId === match.remoteId
    && requested.remotePermalink === match.remotePermalink;
  if (alreadyRepaired) return { status: "already_repaired", match };
  if (!isOrphan(requested)) return { status: "no_match", reason: "item_not_orphan" };

  const itemCandidates = input.items.filter((item) => (
    item.websiteId === input.websiteId
    && item.auditId === requested.auditId
    && normalizedKeyword(item.normalizedKeyword || item.keyword) === keyword
    && exactTitle(item.title) === title
    && isOrphan(item)
  ));
  if (itemCandidates.length > 1) return { status: "ambiguous", reason: "multiple_items" };
  if (itemCandidates.length === 0) return { status: "no_match", reason: "item_not_orphan" };
  return { status: "ready", match };
}

export function verifyRepairPermalink(value: string, status: number) {
  if (status !== 200) return false;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function confirmationPayload(match: CalendarRepairMatch, userId: string, checkedAt: string) {
  return JSON.stringify({
    itemId: match.itemId,
    transferId: match.transferId,
    draftId: match.draftId,
    websiteId: match.websiteId,
    auditId: match.auditId,
    normalizedKeyword: match.normalizedKeyword,
    title: match.title,
    articleKey: match.articleKey,
    remoteId: match.remoteId,
    remotePermalink: match.remotePermalink,
    userId,
    checkedAt,
  });
}

function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function confirmationDigest(
  match: CalendarRepairMatch,
  userId: string,
  checkedAt: string,
  secret: string,
) {
  if (!secret) throw new Error("The confirmation secret is unavailable.");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(confirmationPayload(match, userId, checkedAt))));
}

function constantTimeEqual(expected: string, supplied: string) {
  if (expected.length !== supplied.length || expected.length === 0) return false;
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= expected.charCodeAt(index) ^ supplied.charCodeAt(index);
  }
  return mismatch === 0;
}

export async function confirmationIsValid(
  match: CalendarRepairMatch,
  userId: string,
  checkedAt: string,
  supplied: string,
  now: string,
  secret: string,
) {
  const checkedAtMs = Date.parse(checkedAt);
  const nowMs = Date.parse(now);
  if (!Number.isFinite(checkedAtMs) || !Number.isFinite(nowMs)) return false;
  const ageMs = nowMs - checkedAtMs;
  if (ageMs < 0 || ageMs > 15 * 60 * 1_000) return false;
  if (!supplied || !secret) return false;
  const expected = await confirmationDigest(match, userId, checkedAt, secret);
  return constantTimeEqual(expected, supplied);
}
