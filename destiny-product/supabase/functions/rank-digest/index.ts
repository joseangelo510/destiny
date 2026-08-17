import { withSupabase } from "@supabase/server";
import { notificationRecipient } from "../notification-recipient.ts";
import { buildRankDigest, nextDigestAt, shouldSendDigest, type RankDigestReading, type RankingDigestFrequency } from "./logic.ts";

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

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
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

function movementLabel(row: ReturnType<typeof buildRankDigest>["rows"][number]) {
  if (row.direction === "baseline") return "Baseline";
  if (row.direction === "up") return row.change === null ? "Now ranking" : `Up ${row.change}`;
  if (row.direction === "down") return row.change === null ? "Not found in top 100" : `Down ${Math.abs(row.change)}`;
  return "No change";
}

function positionLabel(found: boolean, position: number | null) {
  return found && position ? `#${position}` : "Not in top 100";
}

function renderEmail(input: {
  siteName: string;
  domain: string;
  digest: ReturnType<typeof buildRankDigest>;
  rankUrl: string;
  accountUrl: string;
  unsubscribeUrl: string;
  firstNotice: boolean;
  isTest: boolean;
}) {
  const rows = input.digest.topMovers.length ? input.digest.topMovers : input.digest.rows.slice(0, 10);
  const tableRows = rows.map((row) => `<tr><td style="padding:12px 8px;border-bottom:1px solid #e3e9e5;font-weight:700">${escapeHtml(row.keyword)}</td><td style="padding:12px 8px;border-bottom:1px solid #e3e9e5">${escapeHtml(positionLabel(row.previousFound === true, row.previousPosition))} → ${escapeHtml(positionLabel(row.currentFound, row.currentPosition))}</td><td style="padding:12px 8px;border-bottom:1px solid #e3e9e5;color:${row.direction === "up" ? "#237451" : row.direction === "down" ? "#a64c42" : "#65746e"};font-weight:700">${escapeHtml(movementLabel(row))}</td></tr>`).join("");
  const firstNotice = input.firstNotice ? `<div style="background:#eef6f1;border:1px solid #d5e8de;border-radius:12px;padding:14px 16px;margin:18px 0"><strong>New:</strong> Destiny will send ranking updates every 3 days. You can change the frequency or turn them off in Account settings.</div>` : "";
  const heading = input.digest.hasComparison ? "Your search visibility moved." : "Your first ranking baseline is ready.";
  const textRows = rows.map((row) => `- ${row.keyword}: ${positionLabel(row.previousFound === true, row.previousPosition)} → ${positionLabel(row.currentFound, row.currentPosition)} (${movementLabel(row)})`).join("\n");
  return {
    subject: `${input.isTest ? "[Test] " : ""}${input.digest.subject}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#20302c"><p style="color:#2a6855;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase">Destiny ranking update · ${escapeHtml(input.domain)}</p><h1 style="font-family:Georgia,serif;font-size:36px;font-weight:500;line-height:1.12;margin:10px 0">${heading}</h1><p>Here is the latest confirmed Google movement for the keywords Destiny tracks for <strong>${escapeHtml(input.siteName)}</strong>.</p>${firstNotice}<div style="display:flex;gap:8px;flex-wrap:wrap;margin:24px 0"><div style="background:#eef6f1;border-radius:12px;padding:14px 18px"><strong style="font-size:26px;color:#237451">${input.digest.counts.up}</strong><br><span>moved up</span></div><div style="background:#fbf1ef;border-radius:12px;padding:14px 18px"><strong style="font-size:26px;color:#a64c42">${input.digest.counts.down}</strong><br><span>moved down</span></div><div style="background:#f3f5f3;border-radius:12px;padding:14px 18px"><strong style="font-size:26px">${input.digest.top10Current}</strong><br><span>in top 10</span></div><div style="background:#f3f5f3;border-radius:12px;padding:14px 18px"><strong style="font-size:26px">${input.digest.averageCurrent ?? "—"}</strong><br><span>average position</span></div></div><table style="border-collapse:collapse;width:100%;font-size:14px"><thead><tr><th align="left" style="padding:10px 8px;border-bottom:2px solid #ccd8d1">Keyword</th><th align="left" style="padding:10px 8px;border-bottom:2px solid #ccd8d1">Previous → current</th><th align="left" style="padding:10px 8px;border-bottom:2px solid #ccd8d1">Change</th></tr></thead><tbody>${tableRows}</tbody></table><p style="margin:28px 0"><a href="${escapeHtml(input.rankUrl)}" style="background:#275f4e;color:#fff;border-radius:10px;display:inline-block;padding:13px 18px;text-decoration:none;font-weight:700">View rank tracker</a></p><p style="color:#71807a;font-size:12px;line-height:1.6">Rankings can fluctuate. Destiny compares the same Google location, language, and device each time and never treats “not found” as position zero.<br><a href="${escapeHtml(input.accountUrl)}" style="color:#526b61">Manage email frequency</a> · <a href="${escapeHtml(input.unsubscribeUrl)}" style="color:#526b61">Unsubscribe from ranking emails</a></p></div>`,
    text: `${heading}\n\n${input.siteName} (${input.domain})\n${input.digest.counts.up} moved up · ${input.digest.counts.down} moved down · ${input.digest.top10Current} in the top 10 · average position ${input.digest.averageCurrent ?? "—"}\n\n${textRows}\n\nView rank tracker: ${input.rankUrl}\nManage email frequency: ${input.accountUrl}\nUnsubscribe: ${input.unsubscribeUrl}`,
  };
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
      const { data: tracked } = await context.supabaseAdmin.from("tracked_keywords").select("id,keyword").eq("website_id", preference.website_id).in("status", ["pending", "active", "error"]).limit(500);
      const keywordIds = (tracked ?? []).map((row) => row.id);
      if (!keywordIds.length) {
        await context.supabaseAdmin.from("notification_preferences").update({ last_digest_status: "skipped", last_digest_error: "No tracked keywords.", next_digest_at: new Date(now.getTime() + 86_400_000).toISOString() }).eq("website_id", preference.website_id);
        results.push({ websiteId: preference.website_id, status: "skipped", reason: "No tracked keywords." });
        continue;
      }
      const { data: observations } = await context.supabaseAdmin.from("rank_observations").select("tracked_keyword_id,observed_at,found,position").eq("website_id", preference.website_id).in("tracked_keyword_id", keywordIds).order("observed_at", { ascending: false }).limit(2000);
      const byKeyword = new Map<string, Observation[]>();
      for (const observation of (observations ?? []) as Observation[]) {
        const values = byKeyword.get(observation.tracked_keyword_id) ?? [];
        if (values.length < 2) byKeyword.set(observation.tracked_keyword_id, [...values, observation]);
      }
      const latestObservationAt = (observations?.[0] as Observation | undefined)?.observed_at ?? null;
      if (!force && !shouldSendDigest(preference.last_digest_sent_at, latestObservationAt)) {
        await context.supabaseAdmin.from("notification_preferences").update({ last_digest_status: "skipped", last_digest_error: "Waiting for fresh rank readings.", next_digest_at: new Date(now.getTime() + 6 * 3_600_000).toISOString() }).eq("website_id", preference.website_id);
        results.push({ websiteId: preference.website_id, status: "skipped", reason: "Waiting for fresh rank readings." });
        continue;
      }
      const readings: RankDigestReading[] = (tracked ?? []).flatMap((keyword) => {
        const history = byKeyword.get(keyword.id) ?? [];
        const current = history[0];
        if (!current) return [];
        const previous = history[1];
        return [{ keyword: keyword.keyword, currentFound: current.found, currentPosition: current.position, previousFound: previous ? previous.found : null, previousPosition: previous?.position ?? null }];
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
      const periodKey = isTest ? `test-${now.toISOString()}` : `reading-${latestObservationAt ?? now.toISOString()}`;
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
      const email = renderEmail({
        siteName: digest.siteName,
        domain: website.normalized_domain,
        digest,
        rankUrl: `${siteUrl}/rank-tracker?site=${encodeURIComponent(preference.website_id)}`,
        accountUrl: `${siteUrl}/account?site=${encodeURIComponent(preference.website_id)}`,
        unsubscribeUrl,
        firstNotice: preference.first_digest_notice_pending,
        isTest,
      });
      const delivery = await sendWithRetry({ apiKey, from, recipient, ...email, idempotencyKey: `destiny-rank-${send.id}`, unsubscribeUrl });
      if (!delivery.sent) {
        await context.supabaseAdmin.from("rank_digest_sends").update({ status: "failed", error: delivery.error, attempt_count: delivery.attempts }).eq("id", send.id);
        await context.supabaseAdmin.from("notification_preferences").update({ last_digest_status: "failed", last_digest_error: delivery.error, next_digest_at: new Date(now.getTime() + 6 * 3_600_000).toISOString() }).eq("website_id", preference.website_id);
        results.push({ websiteId: preference.website_id, status: "failed", reason: delivery.error });
        continue;
      }
      await context.supabaseAdmin.from("rank_digest_sends").update({ status: "sent", provider_message_id: delivery.messageId, attempt_count: delivery.attempts, sent_at: now.toISOString() }).eq("id", send.id);
      if (!isTest) {
        const frequency = preference.ranking_digest_frequency === "three_day" ? "three_day" : "weekly";
        await context.supabaseAdmin.from("notification_preferences").update({ last_digest_sent_at: now.toISOString(), last_digest_status: "sent", last_digest_error: null, first_digest_notice_pending: false, next_digest_at: nextDigestAt(now, frequency).toISOString() }).eq("website_id", preference.website_id);
      }
      results.push({ websiteId: preference.website_id, status: "sent", messageId: delivery.messageId, recipient, subject: email.subject });
    }
    return json({ processed: results.length, results });
  }),
};
