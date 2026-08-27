import { withSupabase } from "@supabase/server";
import {
  confirmationDigest,
  confirmationIsValid,
  normalizedKeyword,
  selectCalendarRepair,
  verifyRepairPermalink,
  type CalendarRepairDraft,
  type CalendarRepairInput,
  type CalendarRepairItem,
  type CalendarRepairMatch,
  type CalendarRepairPreference,
  type CalendarRepairTransfer,
} from "./logic.ts";

type RequestBody = {
  websiteId?: unknown;
  itemId?: unknown;
  mode?: unknown;
  confirmationToken?: unknown;
  checkedAt?: unknown;
};

type StoredScheduleItem = {
  id?: unknown;
  website_id?: unknown;
  audit_id?: unknown;
  keyword?: unknown;
  normalized_keyword?: unknown;
  title?: unknown;
  state?: unknown;
  article_key?: unknown;
  remote_id?: unknown;
  remote_permalink?: unknown;
};

type StoredDraft = {
  id?: unknown;
  website_id?: unknown;
  audit_id?: unknown;
  keyword?: unknown;
  draft?: unknown;
};

type StoredPreference = {
  id?: unknown;
  website_id?: unknown;
  source_audit_id?: unknown;
  normalized_keyword?: unknown;
  decision?: unknown;
};

type StoredTransfer = {
  id?: unknown;
  website_id?: unknown;
  article_key?: unknown;
  publication_status?: unknown;
  remote_id?: unknown;
  remote_permalink?: unknown;
  verification_evidence?: unknown;
};

function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function nullableText(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function evidence(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function scheduleItem(row: StoredScheduleItem): CalendarRepairItem {
  return {
    id: text(row.id),
    websiteId: text(row.website_id),
    auditId: text(row.audit_id),
    keyword: text(row.keyword),
    normalizedKeyword: text(row.normalized_keyword),
    title: text(row.title),
    state: text(row.state),
    articleKey: nullableText(row.article_key),
    remoteId: nullableText(row.remote_id),
    remotePermalink: nullableText(row.remote_permalink),
  };
}

function articleDraft(row: StoredDraft): CalendarRepairDraft {
  const draft = row.draft && typeof row.draft === "object" && !Array.isArray(row.draft)
    ? row.draft as Record<string, unknown>
    : {};
  return {
    id: text(row.id),
    websiteId: text(row.website_id),
    auditId: text(row.audit_id),
    keyword: text(row.keyword),
    title: text(draft.title),
  };
}

function approvedPreference(row: StoredPreference): CalendarRepairPreference {
  return {
    id: text(row.id),
    websiteId: text(row.website_id),
    auditId: text(row.source_audit_id),
    normalizedKeyword: text(row.normalized_keyword),
    decision: text(row.decision),
  };
}

function cmsTransfer(row: StoredTransfer): CalendarRepairTransfer {
  return {
    id: text(row.id),
    websiteId: text(row.website_id),
    articleKey: text(row.article_key),
    publicationStatus: text(row.publication_status),
    remoteId: nullableText(row.remote_id),
    remotePermalink: nullableText(row.remote_permalink),
  };
}

async function publicStatus(permalink: string) {
  try {
    const response = await fetch(permalink, {
      method: "GET",
      headers: { Accept: "text/html" },
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
    });
    await response.body?.cancel().catch(() => undefined);
    return response.status;
  } catch {
    return 0;
  }
}

function confirmationEvidence(match: CalendarRepairMatch, userId: string, checkedAt: string, status: "confirmed_pending_calendar" | "completed") {
  return {
    decision: "D-CALENDAR-ORPHAN-REPAIR-1",
    status,
    confirmedBy: userId,
    confirmedAt: checkedAt,
    itemId: match.itemId,
    transferId: match.transferId,
    draftId: match.draftId,
    preferenceId: match.preferenceId,
    websiteId: match.websiteId,
    auditId: match.auditId,
    normalizedKeyword: match.normalizedKeyword,
    title: match.title,
    articleKey: match.articleKey,
    remoteId: match.remoteId,
    remotePermalink: match.remotePermalink,
    publicHttpStatus: 200,
    matchingMethod: "exact_website_audit_approved_keyword_title_article_key",
  };
}

export default {
  fetch: withSupabase({ auth: "user" }, async (request, context) => {
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
    const body = await request.json().catch(() => ({})) as RequestBody;
    const websiteId = text(body.websiteId).trim();
    const itemId = text(body.itemId).trim();
    const mode = body.mode === "confirm" ? "confirm" : body.mode === "dry_run" ? "dry_run" : "";
    if (!websiteId || !itemId || !mode) return json({ error: "Choose one calendar item and run a dry check first." }, 400);

    const userId = context.userClaims?.id;
    if (!userId) return json({ error: "Sign in again to continue." }, 401);
    const { data: website } = await context.supabase.from("websites").select("id").eq("id", websiteId).maybeSingle();
    if (!website) return json({ error: "You do not have access to that website." }, 403);

    const confirmationSecret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!confirmationSecret) return json({ error: "The confirmation service is unavailable." }, 503);

    const { data: requestedRow, error: requestedError } = await context.supabaseAdmin
      .from("publishing_schedule_items")
      .select("id,website_id,audit_id,keyword,normalized_keyword,title,state,article_key,remote_id,remote_permalink")
      .eq("id", itemId)
      .eq("website_id", websiteId)
      .maybeSingle();
    if (requestedError) return json({ error: "Destiny could not inspect that calendar item." }, 502);
    if (!requestedRow) return json({ eligible: false, status: "no_match", reason: "item_not_found" });

    const requested = scheduleItem(requestedRow as StoredScheduleItem);
    const keyword = normalizedKeyword(requested.normalizedKeyword || requested.keyword);
    const articleKey = `${requested.auditId}:${keyword}`;
    const [itemsResult, preferencesResult, draftsResult, transfersResult] = await Promise.all([
      context.supabaseAdmin.from("publishing_schedule_items")
        .select("id,website_id,audit_id,keyword,normalized_keyword,title,state,article_key,remote_id,remote_permalink")
        .eq("website_id", websiteId)
        .eq("audit_id", requested.auditId)
        .eq("normalized_keyword", keyword)
        .eq("title", requested.title)
        .limit(10),
      context.supabaseAdmin.from("keyword_preferences")
        .select("id,website_id,source_audit_id,normalized_keyword,decision")
        .eq("website_id", websiteId)
        .eq("source_audit_id", requested.auditId)
        .eq("normalized_keyword", keyword)
        .eq("decision", "approved")
        .limit(10),
      context.supabaseAdmin.from("article_drafts")
        .select("id,website_id,audit_id,keyword,draft")
        .eq("website_id", websiteId)
        .eq("audit_id", requested.auditId)
        .limit(100),
      context.supabaseAdmin.from("cms_transfers")
        .select("id,website_id,article_key,publication_status,remote_id,remote_permalink,verification_evidence")
        .eq("website_id", websiteId)
        .eq("article_key", articleKey)
        .eq("publication_status", "verified_live")
        .limit(10),
    ]);
    if (itemsResult.error || preferencesResult.error || draftsResult.error || transfersResult.error) {
      return json({ error: "Destiny could not complete the exact calendar comparison." }, 502);
    }

    const input: CalendarRepairInput = {
      websiteId,
      requestedItemId: itemId,
      items: (itemsResult.data ?? []).map((row) => scheduleItem(row as StoredScheduleItem)),
      preferences: (preferencesResult.data ?? []).map((row) => approvedPreference(row as StoredPreference)),
      drafts: (draftsResult.data ?? []).map((row) => articleDraft(row as StoredDraft)),
      transfers: (transfersResult.data ?? []).map((row) => cmsTransfer(row as StoredTransfer)),
    };
    const result = selectCalendarRepair(input);
    if (result.status !== "ready" && result.status !== "already_repaired") {
      return json({ eligible: false, status: result.status, reason: result.reason });
    }

    const httpStatus = await publicStatus(result.match.remotePermalink);
    if (!verifyRepairPermalink(result.match.remotePermalink, httpStatus)) {
      return json({ eligible: false, status: "no_match", reason: "permalink_not_live", httpStatus });
    }
    if (result.status === "already_repaired" && mode === "dry_run") {
      return json({ eligible: false, status: "already_repaired", match: result.match, httpStatus });
    }

    if (mode === "dry_run") {
      const checkedAt = new Date().toISOString();
      return json({
        eligible: true,
        status: "ready",
        match: result.match,
        httpStatus,
        checkedAt,
        confirmationToken: await confirmationDigest(result.match, userId, checkedAt, confirmationSecret),
        expiresInSeconds: 900,
      });
    }

    const checkedAt = text(body.checkedAt).trim();
    const suppliedToken = text(body.confirmationToken).trim();
    if (!await confirmationIsValid(result.match, userId, checkedAt, suppliedToken, new Date().toISOString(), confirmationSecret)) {
      return json({ error: "Run the dry check again and confirm that exact match." }, 409);
    }

    const storedTransfer = (transfersResult.data ?? []).find((row) => text((row as StoredTransfer).id) === result.match.transferId) as StoredTransfer | undefined;
    const existingEvidence = evidence(storedTransfer?.verification_evidence);
    const pendingEvidence = {
      ...existingEvidence,
      calendarRepair: confirmationEvidence(result.match, userId, checkedAt, "confirmed_pending_calendar"),
    };
    const { data: preparedTransfer, error: prepareError } = await context.supabaseAdmin.from("cms_transfers")
      .update({ verification_evidence: pendingEvidence, updated_at: new Date().toISOString() })
      .eq("id", result.match.transferId)
      .eq("website_id", websiteId)
      .eq("article_key", result.match.articleKey)
      .eq("publication_status", "verified_live")
      .select("id")
      .maybeSingle();
    if (prepareError || !preparedTransfer) return json({ error: "Destiny could not record the confirmed repair evidence." }, 502);

    if (result.status === "ready") {
      const { data: repairedItem, error: repairError } = await context.supabaseAdmin.from("publishing_schedule_items")
        .update({
          state: "published",
          article_key: result.match.articleKey,
          remote_id: result.match.remoteId,
          remote_permalink: result.match.remotePermalink,
        })
        .eq("id", result.match.itemId)
        .eq("website_id", websiteId)
        .eq("audit_id", result.match.auditId)
        .eq("normalized_keyword", result.match.normalizedKeyword)
        .eq("title", result.match.title)
        .eq("state", "needs_review")
        .is("article_key", null)
        .is("remote_id", null)
        .is("remote_permalink", null)
        .select("id")
        .maybeSingle();
      if (repairError || !repairedItem) return json({ error: "The calendar changed after the dry check. No calendar row was repaired." }, 409);
    }

    const completedEvidence = {
      ...existingEvidence,
      calendarRepair: confirmationEvidence(result.match, userId, checkedAt, "completed"),
    };
    const { data: completedTransfer, error: completionError } = await context.supabaseAdmin.from("cms_transfers")
      .update({ verification_evidence: completedEvidence, updated_at: new Date().toISOString() })
      .eq("id", result.match.transferId)
      .eq("website_id", websiteId)
      .eq("article_key", result.match.articleKey)
      .eq("publication_status", "verified_live")
      .select("id")
      .maybeSingle();
    if (completionError || !completedTransfer) {
      return json({ error: "The calendar was repaired, but its final evidence receipt needs a retry.", repaired: true }, 502);
    }

    return json({ repaired: true, status: "published", match: result.match, httpStatus, evidence: completedEvidence.calendarRepair });
  }),
};
