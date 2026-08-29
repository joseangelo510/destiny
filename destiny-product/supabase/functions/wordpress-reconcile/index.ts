import { withSupabase } from "@supabase/server";
import { fingerprintFromRemote, fingerprintMatches, plainText, publicationState, verifyPublicPage } from "./logic.ts";

type ConnectionSecret = { integration_id?: unknown; credentials?: unknown };

function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export default {
  fetch: withSupabase({ auth: "user" }, async (request, context) => {
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const websiteId = typeof body.websiteId === "string" ? body.websiteId.trim() : "";
    const articleKey = typeof body.articleKey === "string" ? body.articleKey.trim().slice(0, 500) : "";
    if (!websiteId || !articleKey) return json({ error: "Choose a WordPress article to check." }, 400);
    const userId = context.userClaims?.id;
    if (!userId) return json({ error: "Sign in again to continue." }, 401);
    const { data: website } = await context.supabase.from("websites").select("id").eq("id", websiteId).maybeSingle();
    if (!website) return json({ error: "You do not have access to that website." }, 403);

    const { data: stored, error: credentialError } = await context.supabaseAdmin.rpc("read_wordpress_connection_credentials", { p_user_id: userId, p_website_id: websiteId });
    const secret = stored && typeof stored === "object" && !Array.isArray(stored) ? stored as ConnectionSecret : {};
    const credentials = secret.credentials && typeof secret.credentials === "object" && !Array.isArray(secret.credentials) ? secret.credentials as Record<string, unknown> : {};
    const integrationId = typeof secret.integration_id === "string" ? secret.integration_id : "";
    const siteUrl = typeof credentials.site_url === "string" ? credentials.site_url.replace(/\/+$/, "") : "";
    const username = typeof credentials.username === "string" ? credentials.username : "";
    const password = typeof credentials.application_password === "string" ? credentials.application_password : "";
    if (credentialError || !integrationId || !siteUrl || !username || !password) return json({ error: "Reconnect WordPress before checking this article." }, 409);

    const { data: transfer } = await context.supabaseAdmin.from("cms_transfers")
      .select("id,remote_id,remote_permalink,delivered_fingerprint,publication_status,verified_live_at,featured_media_id,media_ids")
      .eq("website_id", websiteId).eq("integration_id", integrationId).eq("article_key", articleKey).maybeSingle();
    if (!transfer?.remote_id) return json({ error: "Send this article to WordPress before checking its status." }, 409);

    const authorization = `Basic ${btoa(`${username}:${password}`)}`;
    let remoteResponse: Response;
    try {
      remoteResponse = await fetch(`${siteUrl}/wp-json/wp/v2/posts/${encodeURIComponent(String(transfer.remote_id))}?context=edit`, {
        headers: { Authorization: authorization, Accept: "application/json" },
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      return json({ error: "Rebound SEO could not reach WordPress to refresh this article." }, 502);
    }
    const remote = await remoteResponse.json().catch(() => ({})) as {
      status?: unknown; link?: unknown; modified_gmt?: unknown; date_gmt?: unknown;
      content?: { rendered?: unknown }; title?: { rendered?: unknown };
    };
    if (!remoteResponse.ok || typeof remote.status !== "string") return json({ error: "WordPress could not return the current article status." }, 502);

    const remoteStatus = remote.status;
    const permalink = typeof remote.link === "string" ? remote.link : typeof transfer.remote_permalink === "string" ? transfer.remote_permalink : "";
    const content = typeof remote.content?.rendered === "string" ? remote.content.rendered : "";
    const remoteTitle = typeof remote.title?.rendered === "string" ? remote.title.rendered : "";
    const fingerprint = typeof transfer.delivered_fingerprint === "string" && transfer.delivered_fingerprint.trim()
      ? transfer.delivered_fingerprint
      : fingerprintFromRemote(remoteTitle, content);
    const contentMatches = fingerprintMatches(content, fingerprint);
    let evidence: Record<string, unknown> = { remoteStatus, contentMatches, checkedAt: new Date().toISOString() };
    let state = publicationState(remoteStatus, contentMatches);
    let renderedTitle = "";
    let verifiedLiveAt = transfer.verified_live_at as string | null;

    if (remoteStatus === "publish" && permalink) {
      state = "published_unverified";
      try {
        const publicResponse = await fetch(permalink, { headers: { Accept: "text/html" }, redirect: "follow", signal: AbortSignal.timeout(20_000) });
        const html = await publicResponse.text();
        const mediaIds = Array.isArray(transfer.media_ids) ? transfer.media_ids : [];
        const featuredImageRequired = transfer.featured_media_id !== null && transfer.featured_media_id !== undefined;
        const expectedInlineImages = Math.max(0, mediaIds.length - (featuredImageRequired ? 1 : 0));
        const verification = verifyPublicPage({ status: publicResponse.status, html, permalink, fingerprint, featuredImageRequired, expectedInlineImages });
        renderedTitle = verification.renderedTitle;
        evidence = { ...evidence, ...verification };
        state = publicationState(remoteStatus, contentMatches, verification.verified);
        if (verification.verified) verifiedLiveAt = verifiedLiveAt ?? new Date().toISOString();
      } catch {
        state = "verification_failed";
        evidence = { ...evidence, verified: false, reason: "The public page did not respond." };
      }
    }

    const now = new Date().toISOString();
    const { error: updateError } = await context.supabaseAdmin.from("cms_transfers").update({
      publication_status: state,
      remote_status: remoteStatus,
      remote_permalink: permalink || null,
      remote_modified_at: typeof remote.modified_gmt === "string" && remote.modified_gmt ? `${remote.modified_gmt}Z` : null,
      remote_content_hash: await sha256(plainText(content)),
      delivered_fingerprint: fingerprint || null,
      scheduled_for: remoteStatus === "future" && typeof remote.date_gmt === "string" && remote.date_gmt ? `${remote.date_gmt}Z` : null,
      last_reconciled_at: now,
      verified_live_at: verifiedLiveAt,
      verification_evidence: evidence,
      seo_title_rendered: renderedTitle || null,
      updated_at: now,
    }).eq("id", transfer.id);
    if (updateError) return json({ error: "Rebound SEO checked WordPress but could not save the result." }, 502);

    return json({ reconciled: true, publicationStatus: state, remotePermalink: permalink || null, lastReconciledAt: now, verifiedLiveAt, verificationEvidence: evidence, seoTitleRendered: renderedTitle || null });
  }),
};
