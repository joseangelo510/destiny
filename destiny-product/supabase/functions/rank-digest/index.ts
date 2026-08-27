import { withSupabase } from "@supabase/server";
import { notificationRecipient } from "../notification-recipient.ts";
import { renderRankDigestEmail } from "./email.ts";
import { buildRankDigest, nextDigestAt, selectDigestOpportunities, shouldSendDigest, type RankDigestLedgerState, type RankDigestOpportunity, type RankDigestReading, type RankingDigestFrequency } from "./logic.ts";
import { reconcileRankDigestProviderReceipt } from "./reconciliation.ts";

type PreferenceRow = {
  website_id: string;
  organization_id: string;
  ranking_digest_frequency: RankingDigestFrequency;
  last_digest_sent_at: string | null;
  first_digest_notice_pending: boolean;
  websites: { business_name: string; normalized_domain: string; notification_email: string | null } | Array<{ business_name: string; normalized_domain: string; notification_email: string | null }>;
};

type DigestRequest = { websiteId?: unknown; force?: unknown; isTest?: unknown };
type Observation = { tracked_keyword_id: string; observed_at: string; found: boolean; position: number | null };
type TrackedKeyword = { id: string; keyword: string; normalized_keyword: string; location_name: string; device: string };
type KeywordPreference = { normalized_keyword: string; decision: string; search_volume: number | null; provider_intent: string | null; difficulty: number | null; priority_score: number | null };

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function websiteFrom(row: PreferenceRow) {
  return Array.isArray(row.websites) ? row.websites[0] : row.websites;
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function signature(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
}

async function unsubscribeToken(websiteId: string, secret: string) {
  const payload = `v1:${websiteId}`;
  return `v1.${websiteId}.${await signature(payload, secret)}`;
}

async function verifiedWebsiteId(token: string, secret: string) {
  const [version, websiteId, supplied] = token.split(".");
  if (version !== "v1" || !/^[0-9a-f-]{36}$/i.test(websiteId ?? "") || !supplied) return null;
  const expected = await signature(`v1:${websiteId}`, secret);
  if (expected.length !== supplied.length) return null;
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) mismatch |= expected.charCodeAt(index) ^ supplied.charCodeAt(index);
  return mismatch === 0 ? websiteId : null;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizedKeyword(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

function opportunityCandidates(rawProviderPayload: unknown): RankDigestOpportunity[] {
  const provider = record(record(rawProviderPayload).providerResult);
  return list(provider.keywords).flatMap((value) => {
    const keyword = record(value);
    const phrase = typeof keyword.keyword === "string" ? keyword.keyword.trim() : "";
    const volume = Number(keyword.searchVolume ?? 0);
    if (!phrase || !Number.isFinite(volume) || volume <= 0) return [];
    const rawIntent = String(keyword.providerIntent ?? keyword.intent ?? "informational");
    const intent = rawIntent === "transactional" || rawIntent === "commercial" || rawIntent === "navigational" ? rawIntent : "informational";
    const rawDifficulty = Number(keyword.difficulty);
    const difficulty = Number.isFinite(rawDifficulty) && rawDifficulty >= 0 && rawDifficulty <= 100 ? rawDifficulty : null;
    const opportunity = String(keyword.opportunity ?? "site_idea");
    const evidenceSource = opportunity === "competitor_gap" ? "competitor_gap" as const : Number(keyword.rank ?? 0) > 0 ? "serp_scan" as const : "site_audit" as const;
    return [{
      keyword: phrase,
      estimatedVolume: Math.round(volume),
      intent,
      difficulty,
      priorityScore: Math.max(0, Math.min(100, Math.round(Number(keyword.priorityScore ?? 0) || 0))),
      reason: String(keyword.priorityReason ?? keyword.reason ?? (evidenceSource === "competitor_gap" ? "Competitors earn visibility for this relevant search." : "This search matches the business and has meaningful demand.")).slice(0, 220),
      evidenceSource,
    }];
  });
}

async function sendWithRetry(input: { apiKey: string; from: string; recipient: string; subject: string; html: string; text: string; idempotencyKey: string; unsubscribeUrl: string }) {
  let lastError = "Email delivery did not start.";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${input.apiKey}`, "Content-Type": "application/json", "Idempotency-Key": input.idempotencyKey },
        body: JSON.stringify({
          from: input.from,
          to: [input.recipient],
          subject: input.subject,
          html: input.html,
          text: input.text,
          headers: { "List-Unsubscribe": `<${input.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
          tags: [{ name: "product", value: "destiny" }, { name: "message", value: "rank_digest" }],
        }),
        signal: AbortSignal.timeout(15_000),
      });
      const payload = await response.json().catch(() => ({})) as { id?: unknown; message?: unknown };
      if (response.ok) return { sent: true as const, messageId: typeof payload.id === "string" ? payload.id : null, attempts: attempt };
      lastError = typeof payload.message === "string" ? payload.message.slice(0, 300) : `Email provider returned HTTP ${response.status}.`;
    } catch (cause) {
      lastError = cause instanceof Error ? cause.message.slice(0, 300) : "Email provider request failed.";
    }
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** (attempt - 1)));
  }
  return { sent: false as const, error: lastError, attempts: 3 };
}

async function reconcileProviderReceipts(context: { supabaseAdmin: any }, apiKey: string) {
  const { data } = await context.supabaseAdmin.from("rank_digest_sends")
    .select("id,website_id,provider_message_id,status,is_test")
    .in("status", ["sending", "sent", "accepted"])
    .not("provider_message_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);
  for (const send of data ?? []) {
    const checkedAt = new Date().toISOString();
    await reconcileRankDigestProviderReceipt({
      id: send.id,
      websiteId: send.website_id,
      status: send.status as RankDigestLedgerState,
      isTest: send.is_test === true,
    }, {
      apiKey,
      messageId: send.provider_message_id,
      checkedAt,
    }, {
      updateSend: async (sendId, update) => {
        await context.supabaseAdmin.from("rank_digest_sends").update(update).eq("id", sendId);
      },
      updatePreference: async (websiteId, update) => {
        await context.supabaseAdmin.from("notification_preferences").update(update).eq("website_id", websiteId);
      },
      updateAttempt: async (sendId, update) => {
        await context.supabaseAdmin.from("rank_digest_sends").update(update).eq("id", sendId);
      },
      logFailure: (failure) => {
        console.error(JSON.stringify({ event: "rank_digest_receipt_lookup_failed", ...failure }));
      },
    });
  }
}

export default {
  fetch: withSupabase({ auth: "none" }, async (request, context) => {
    const url = new URL(request.url);
    const tokenSecret = Deno.env.get("RANK_DIGEST_TOKEN_SECRET")?.trim() || Deno.env.get("RANK_TRACKER_CRON_SECRET")?.trim() || "";
    const unsubscribe = url.searchParams.get("unsubscribe");
    if (unsubscribe) {
      if (!tokenSecret) return json({ error: "Unsubscribe is not configured." }, 503);
      const websiteId = await verifiedWebsiteId(unsubscribe, tokenSecret);
      if (!websiteId) return json({ error: "This unsubscribe link is invalid." }, 400);
      const now = new Date().toISOString();
      const { error } = await context.supabaseAdmin.from("notification_preferences").update({ ranking_digest_frequency: "off", next_digest_at: null, unsubscribed_at: now, updated_at: now }).eq("website_id", websiteId);
      if (error) return json({ error: "Destiny could not update this preference." }, 500);
      return request.method === "GET"
        ? new Response("<!doctype html><html><body style=\"font-family:Arial,sans-serif;padding:40px;color:#20302c\"><h1>Ranking emails are off.</h1><p>You can turn them back on anytime in Destiny Account settings.</p></body></html>", { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } })
        : json({ unsubscribed: true });
    }

    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
    const expectedSecret = Deno.env.get("RANK_TRACKER_CRON_SECRET")?.trim();
    if (!expectedSecret || request.headers.get("x-rank-tracker-secret") !== expectedSecret) return json({ error: "Unauthorized." }, 401);
    const apiKey = Deno.env.get("RESEND_API_KEY")?.trim();
    const from = Deno.env.get("DESTINY_FROM_EMAIL")?.trim();
    const siteUrl = Deno.env.get("DESTINY_SITE_URL")?.trim().replace(/\/$/, "");
    if (!apiKey || !from || !siteUrl || !tokenSecret) return json({ error: "Ranking email delivery is not configured." }, 503);
    const body = await request.json().catch(() => ({})) as DigestRequest;
    const websiteId = typeof body.websiteId === "string" && /^[0-9a-f-]{36}$/i.test(body.websiteId) ? body.websiteId : null;
    const force = body.force === true;
    const isTest = body.isTest === true;
    const now = new Date();
    await reconcileProviderReceipts(context, apiKey);

    let query = context.supabaseAdmin.from("notification_preferences")
      .select("website_id,organization_id,ranking_digest_frequency,last_digest_sent_at,first_digest_notice_pending,websites!inner(business_name,normalized_domain,notification_email)")
      .neq("ranking_digest_frequency", "off")
      .order("next_digest_at")
      .limit(50);
    query = websiteId ? query.eq("website_id", websiteId) : query.lte("next_digest_at", now.toISOString());
    const { data, error } = await query;
    if (error) return json({ error: error.message }, 500);
    const results: unknown[] = [];

    for (const preference of (data ?? []) as unknown as PreferenceRow[]) {
      const website = websiteFrom(preference);
      if (!website) continue;
      const [{ data: trackedData }, { data: preferencesData }, { data: latestAudit }] = await Promise.all([
        context.supabaseAdmin.from("tracked_keywords").select("id,keyword,normalized_keyword,location_name,device").eq("website_id", preference.website_id).in("status", ["pending", "active", "error"]).limit(500),
        context.supabaseAdmin.from("keyword_preferences").select("normalized_keyword,decision,search_volume,provider_intent,difficulty,priority_score").eq("website_id", preference.website_id),
        context.supabaseAdmin.from("audits").select("id,completed_at,audit_metrics(raw_provider_payload)").eq("website_id", preference.website_id).eq("status", "complete").order("completed_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      const tracked = (trackedData ?? []) as TrackedKeyword[];
      const keywordPreferences = (preferencesData ?? []) as KeywordPreference[];
      const keywordIds = tracked.map((row) => row.id);
      const observationResult = keywordIds.length
        ? await context.supabaseAdmin.from("rank_observations").select("tracked_keyword_id,observed_at,found,position").eq("website_id", preference.website_id).in("tracked_keyword_id", keywordIds).order("observed_at", { ascending: false }).limit(2000)
        : { data: [] as Observation[] };
      const observations = observationResult.data ?? [];
      const byKeyword = new Map<string, Observation[]>();
      for (const observation of observations as Observation[]) {
        const values = byKeyword.get(observation.tracked_keyword_id) ?? [];
        if (values.length < 2) byKeyword.set(observation.tracked_keyword_id, [...values, observation]);
      }
      const latestObservationAt = (observations[0] as Observation | undefined)?.observed_at ?? null;
      const metricRow = Array.isArray(latestAudit?.audit_metrics) ? latestAudit.audit_metrics[0] : latestAudit?.audit_metrics;
      const auditCandidates = opportunityCandidates(metricRow?.raw_provider_payload);
      const candidateByKeyword = new Map(auditCandidates.map((candidate) => [normalizedKeyword(candidate.keyword), candidate]));
      const preferenceByKeyword = new Map(keywordPreferences.map((item) => [item.normalized_keyword, item]));
      const declined = keywordPreferences.filter((item) => item.decision === "declined").map((item) => item.normalized_keyword);
      const opportunities = selectDigestOpportunities(auditCandidates, [...tracked.map((item) => item.normalized_keyword), ...declined]);
      const latestEvidenceAt = keywordIds.length ? latestObservationAt : typeof latestAudit?.completed_at === "string" ? latestAudit.completed_at : null;
      if (!keywordIds.length && !opportunities.length) {
        await context.supabaseAdmin.from("notification_preferences").update({ last_digest_status: "skipped", last_digest_error: "No tracked keywords or audit opportunities yet.", next_digest_at: new Date(now.getTime() + 86_400_000).toISOString() }).eq("website_id", preference.website_id);
        results.push({ websiteId: preference.website_id, status: "skipped", reason: "No tracked keywords or audit opportunities yet." });
        continue;
      }
      if (keywordIds.length && !latestObservationAt) {
        await context.supabaseAdmin.from("notification_preferences").update({ last_digest_status: "skipped", last_digest_error: "Waiting for the first live rank reading.", next_digest_at: new Date(now.getTime() + 6 * 3_600_000).toISOString() }).eq("website_id", preference.website_id);
        results.push({ websiteId: preference.website_id, status: "skipped", reason: "Waiting for the first live rank reading." });
        continue;
      }
      if (!force && !shouldSendDigest(preference.last_digest_sent_at, latestEvidenceAt)) {
        await context.supabaseAdmin.from("notification_preferences").update({ last_digest_status: "skipped", last_digest_error: "Waiting for fresh rank readings.", next_digest_at: new Date(now.getTime() + 6 * 3_600_000).toISOString() }).eq("website_id", preference.website_id);
        results.push({ websiteId: preference.website_id, status: "skipped", reason: "Waiting for fresh rank readings." });
        continue;
      }
      const readings: RankDigestReading[] = tracked.flatMap((keyword) => {
        const history = byKeyword.get(keyword.id) ?? [];
        const current = history[0];
        if (!current) return [];
        const previous = history[1];
        const preferenceEvidence = preferenceByKeyword.get(keyword.normalized_keyword);
        const auditEvidence = candidateByKeyword.get(keyword.normalized_keyword);
        return [{
          keyword: keyword.keyword,
          currentFound: current.found,
          currentPosition: current.position,
          previousFound: previous ? previous.found : null,
          previousPosition: previous?.position ?? null,
          searchVolume: preferenceEvidence?.search_volume ?? auditEvidence?.estimatedVolume ?? null,
        }];
      });
      const digest = buildRankDigest(website.business_name?.trim() || website.normalized_domain, readings);
      const { data: organization } = await context.supabaseAdmin.from("organizations").select("owner_id").eq("id", preference.organization_id).maybeSingle();
      const { data: profile } = organization?.owner_id ? await context.supabaseAdmin.from("profiles").select("contact_email").eq("id", organization.owner_id).maybeSingle() : { data: null };
      const recipient = notificationRecipient(website.notification_email, profile?.contact_email);
      if (!recipient) {
        await context.supabaseAdmin.from("notification_preferences").update({ last_digest_status: "failed", last_digest_error: "No valid recipient email.", next_digest_at: new Date(now.getTime() + 86_400_000).toISOString() }).eq("website_id", preference.website_id);
        results.push({ websiteId: preference.website_id, status: "failed", reason: "No valid recipient email." });
        continue;
      }
      const periodKey = isTest ? `test-${now.toISOString()}` : `evidence-${latestEvidenceAt ?? now.toISOString()}`;
      const { data: send, error: ledgerError } = await context.supabaseAdmin.from("rank_digest_sends").insert({
        website_id: preference.website_id,
        organization_id: preference.organization_id,
        period_key: periodKey,
        recipient,
        is_test: isTest,
        status: "sending",
        keywords_compared: readings.length,
        moved_up: digest.counts.up,
        moved_down: digest.counts.down,
        entered_top_10: digest.counts.enteredTop10,
        left_top_10: digest.counts.leftTop10,
      }).select("id").maybeSingle();
      if (ledgerError || !send) {
        results.push({ websiteId: preference.website_id, status: ledgerError?.code === "23505" ? "duplicate" : "failed", reason: ledgerError?.message ?? "Could not create delivery ledger." });
        continue;
      }
      const token = await unsubscribeToken(preference.website_id, tokenSecret);
      const unsubscribeUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/rank-digest?unsubscribe=${encodeURIComponent(token)}`;
      const observationDates = observations.map((item) => item.observed_at).filter(Boolean).sort();
      const email = renderRankDigestEmail({
        siteName: digest.siteName,
        domain: website.normalized_domain,
        digest,
        opportunities,
        rankUrl: `${siteUrl}/rank-tracker?site=${encodeURIComponent(preference.website_id)}`,
        keywordStrategyUrl: `${siteUrl}/keywords?site=${encodeURIComponent(preference.website_id)}`,
        accountUrl: `${siteUrl}/account?site=${encodeURIComponent(preference.website_id)}`,
        unsubscribeUrl,
        firstNotice: preference.first_digest_notice_pending,
        isTest,
        measurement: {
          locationName: tracked[0]?.location_name || "United States",
          device: tracked[0]?.device || "Desktop",
          rangeStart: observationDates[0] ?? latestEvidenceAt,
          rangeEnd: observationDates.at(-1) ?? latestEvidenceAt,
        },
      });
      const delivery = await sendWithRetry({ apiKey, from, recipient, ...email, idempotencyKey: `destiny-rank-${send.id}`, unsubscribeUrl });
      if (!delivery.sent) {
        await context.supabaseAdmin.from("rank_digest_sends").update({ status: "failed", error: delivery.error, attempt_count: delivery.attempts }).eq("id", send.id);
        await context.supabaseAdmin.from("notification_preferences").update({ last_digest_status: "failed", last_digest_error: delivery.error, next_digest_at: new Date(now.getTime() + 6 * 3_600_000).toISOString() }).eq("website_id", preference.website_id);
        results.push({ websiteId: preference.website_id, status: "failed", reason: delivery.error });
        continue;
      }
      await context.supabaseAdmin.from("rank_digest_sends").update({ status: "accepted", provider_message_id: delivery.messageId, provider_event: "sent", last_checked_at: now.toISOString(), attempt_count: delivery.attempts, sent_at: now.toISOString() }).eq("id", send.id);
      if (!isTest) {
        const frequency = preference.ranking_digest_frequency === "three_day" ? "three_day" : "weekly";
        await context.supabaseAdmin.from("notification_preferences").update({ last_digest_sent_at: now.toISOString(), last_digest_status: "accepted", last_digest_error: null, first_digest_notice_pending: false, next_digest_at: nextDigestAt(now, frequency).toISOString() }).eq("website_id", preference.website_id);
      }
      results.push({ websiteId: preference.website_id, status: "accepted", messageId: delivery.messageId, recipient, subject: email.subject });
    }
    return json({ processed: results.length, results });
  }),
};
