import { withSupabase } from "@supabase/server";
import { canUpdateWordPressDraft, contentFingerprint, prepareDraftBody, verifyDeliveredDraftMedia, wordpressDraftPayload, wordpressEditUrl, wordpressPostEndpoint, type UploadedWordPressMedia, type WordPressMediaInput } from "./logic.ts";

type ConnectionSecret = {
  integration_id?: unknown;
  credentials?: unknown;
  metadata?: unknown;
};

function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
}

async function contentHash(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function estimateTitleWidth(value: string) {
  return Math.round([...value].reduce((width, character) => width + (/\s/.test(character) ? 4 : /[ilI1.,'`:;|!]/.test(character) ? 4.2 : /[mwMW@%&]/.test(character) ? 11.5 : /[A-Z0-9]/.test(character) ? 8.8 : 7.6), 0));
}

function wordpressFieldReport(metaTitle: string, titleSuffix: string, mediaCount: number) {
  const rendered = `${metaTitle}${titleSuffix}`;
  const width = estimateTitleWidth(rendered);
  return [
    { field: "title", label: "Article headline", status: "transferred", note: "Used as the WordPress post title." },
    { field: "", label: "SEO/meta title", status: "needs_review", note: `Copy “${metaTitle}” into the connected WordPress SEO plugin. Estimated rendered title: “${rendered}” (${width}px${width > 580 ? "; shorten before publishing" : ""}). Rebound SEO verifies the actual title after publication.` },
    { field: "excerpt", label: "Meta description", status: "transferred", note: "Transferred as the WordPress excerpt; confirm your SEO plugin also uses it." },
    ...(mediaCount ? [{
      field: "featured_media",
      label: mediaCount === 1 ? "Dedicated featured image" : `Featured image + ${mediaCount - 1} inline graphic${mediaCount === 2 ? "" : "s"}`,
      status: "transferred",
      note: "Rebound SEO uploaded a separate social-ready featured image and placed each captioned inline graphic in its intended article section.",
    }] : []),
  ];
}

function decodeBase64(value: string) {
  const decoded = atob(value);
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) bytes[index] = decoded.charCodeAt(index);
  return bytes;
}

async function deleteUploadedMedia(siteUrl: string, authorization: string, ids: number[]) {
  await Promise.all(ids.map((id) => fetch(`${siteUrl}/wp-json/wp/v2/media/${id}?force=true`, {
    method: "DELETE",
    headers: { Authorization: authorization, Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null)));
}

async function uploadWordPressMedia(siteUrl: string, authorization: string, planned: WordPressMediaInput[]) {
  const uploaded: UploadedWordPressMedia[] = [];
  try {
    for (const item of planned) {
      const response = await fetch(`${siteUrl}/wp-json/wp/v2/media`, {
        method: "POST",
        headers: {
          Authorization: authorization,
          Accept: "application/json",
          "Content-Type": item.mimeType,
          "Content-Disposition": `attachment; filename="${item.filename}"`,
        },
        body: decodeBase64(item.base64),
        signal: AbortSignal.timeout(25_000),
      });
      const remote = await response.json().catch(() => ({})) as { id?: unknown; source_url?: unknown };
      if (!response.ok || typeof remote.id !== "number" || typeof remote.source_url !== "string") throw new Error(`WordPress rejected graphic upload (${response.status}).`);
      const metadata = await fetch(`${siteUrl}/wp-json/wp/v2/media/${remote.id}`, {
        method: "POST",
        headers: { Authorization: authorization, Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ alt_text: item.alt, ...(item.caption ? { caption: item.caption } : {}) }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!metadata.ok) throw new Error(`WordPress could not save graphic alt text (${metadata.status}).`);
      uploaded.push({ id: remote.id, sourceUrl: remote.source_url, alt: item.alt, role: item.role, caption: item.caption, placementAfterHeading: item.placementAfterHeading });
    }
    return uploaded;
  } catch (cause) {
    await deleteUploadedMedia(siteUrl, authorization, uploaded.map((item) => item.id));
    throw cause;
  }
}

export default {
  fetch: withSupabase({ auth: "user" }, async (request, context) => {
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

    let draft: ReturnType<typeof prepareDraftBody>;
    try { draft = prepareDraftBody(await request.json() as Record<string, unknown>); }
    catch (cause) { return json({ error: cause instanceof Error ? cause.message : "Review the approved article." }, 400); }

    const userId = context.userClaims?.id;
    if (!userId) return json({ error: "Sign in again to continue." }, 401);

    const { data: website } = await context.supabase.from("websites").select("id").eq("id", draft.websiteId).maybeSingle();
    if (!website) return json({ error: "You do not have access to that website." }, 403);

    const { data: stored, error: credentialError } = await context.supabaseAdmin.rpc("read_wordpress_connection_credentials", {
      p_user_id: userId,
      p_website_id: draft.websiteId,
    });
    const secret = stored && typeof stored === "object" && !Array.isArray(stored) ? stored as ConnectionSecret : {};
    const credentials = secret.credentials && typeof secret.credentials === "object" && !Array.isArray(secret.credentials)
      ? secret.credentials as Record<string, unknown>
      : {};
    const metadata = "metadata" in secret && secret.metadata && typeof secret.metadata === "object" && !Array.isArray(secret.metadata)
      ? secret.metadata as Record<string, unknown>
      : {};
    const integrationId = typeof secret.integration_id === "string" ? secret.integration_id : "";
    const siteUrl = typeof credentials.site_url === "string" ? credentials.site_url.replace(/\/+$/, "") : "";
    const username = typeof credentials.username === "string" ? credentials.username : "";
    const applicationPassword = typeof credentials.application_password === "string" ? credentials.application_password : "";
    const titleSuffix = typeof metadata.estimated_title_suffix === "string" ? metadata.estimated_title_suffix : "";
    if (credentialError || !integrationId || !siteUrl || !username || !applicationPassword) {
      return json({ error: "Connect WordPress before sending this article." }, 409);
    }

    const hash = await contentHash(JSON.stringify({ renderingVersion: draft.renderingVersion, ...wordpressDraftPayload(draft), media: draft.media.map((item) => ({ filename: item.filename, alt: item.alt, role: item.role, caption: item.caption, placementAfterHeading: item.placementAfterHeading, bytes: item.base64.length })) }));
    const { data: existing } = await context.supabaseAdmin.from("cms_transfers")
      .select("id,status,content_hash,remote_id,remote_edit_url,publication_status,remote_permalink,verified_live_at,field_report")
      .eq("integration_id", integrationId)
      .eq("article_key", draft.articleKey)
      .maybeSingle();
    if (existing?.status === "succeeded") {
      if (existing.content_hash === hash && existing.remote_edit_url) {
        return json({ delivered: true, remoteEditUrl: existing.remote_edit_url, reused: true, publicationStatus: existing.publication_status, remotePermalink: existing.remote_permalink, verifiedLiveAt: existing.verified_live_at, fieldReport: existing.field_report ?? wordpressFieldReport(draft.metaTitle, titleSuffix, draft.media.length) });
      }
    }
    if (existing?.status === "pending") return json({ error: "Rebound SEO is already sending this article to WordPress." }, 409);

    const authorization = `Basic ${btoa(`${username}:${applicationPassword}`)}`;
    const updateRemoteId = existing?.status === "succeeded" && existing.remote_id ? String(existing.remote_id) : "";
    if (updateRemoteId) {
      let currentResponse: Response;
      try {
        currentResponse = await fetch(`${wordpressPostEndpoint(siteUrl, updateRemoteId)}?context=edit`, {
          headers: { Authorization: authorization, Accept: "application/json" },
          signal: AbortSignal.timeout(20_000),
        });
      } catch {
        return json({ error: "Rebound SEO could not verify the existing WordPress draft before updating it." }, 502);
      }
      const current = await currentResponse.json().catch(() => ({})) as { status?: unknown };
      if (!currentResponse.ok || typeof current.status !== "string") return json({ error: "WordPress could not return the existing draft before an update." }, 502);
      if (!canUpdateWordPressDraft(current.status)) {
        return json({ error: "Rebound SEO will not overwrite a published article. Create a new draft or edit the live article directly in WordPress.", remoteEditUrl: existing.remote_edit_url }, 409);
      }
    }

    const pendingWrite = existing
      ? context.supabaseAdmin.from("cms_transfers").update({ status: "pending", publication_status: "delivering", content_hash: hash, error_class: null, error_detail: null, attempt_count: 1, updated_at: new Date().toISOString() }).eq("id", existing.id)
      : context.supabaseAdmin.from("cms_transfers").insert({
        website_id: draft.websiteId,
        integration_id: integrationId,
        article_key: draft.articleKey,
        content_hash: hash,
        status: "pending",
        publication_status: "delivering",
        attempt_count: 1,
      });
    const { error: pendingError } = await pendingWrite;
    if (pendingError) return json({ error: "Rebound SEO is already sending this article to WordPress." }, 409);

    let uploadedMedia: UploadedWordPressMedia[] = [];
    try {
      uploadedMedia = await uploadWordPressMedia(siteUrl, authorization, draft.media);
    } catch (cause) {
      await context.supabaseAdmin.from("cms_transfers").update({ status: "failed", publication_status: "delivery_failed", error_class: "media_upload_failed", error_detail: cause instanceof Error ? cause.message : "WordPress rejected a planned graphic.", updated_at: new Date().toISOString() }).eq("integration_id", integrationId).eq("article_key", draft.articleKey);
      return json({ error: "WordPress could not receive every planned graphic, so Rebound SEO did not create an incomplete draft." }, 502);
    }

    let response: Response;
    try {
      response = await fetch(wordpressPostEndpoint(siteUrl, updateRemoteId), {
        method: "POST",
        headers: {
          Authorization: authorization,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(wordpressDraftPayload(draft, uploadedMedia)),
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      await deleteUploadedMedia(siteUrl, authorization, uploadedMedia.map((item) => item.id));
      await context.supabaseAdmin.from("cms_transfers").update({ status: "failed", publication_status: "delivery_failed", error_class: "unreachable", error_detail: "WordPress did not respond.", updated_at: new Date().toISOString() }).eq("integration_id", integrationId).eq("article_key", draft.articleKey);
      return json({ error: "Rebound SEO could not reach WordPress. Test the connection and try again." }, 502);
    }

    const remote = await response.json().catch(() => ({})) as { id?: unknown; link?: unknown; status?: unknown; modified_gmt?: unknown; featured_media?: unknown; content?: { rendered?: unknown } };
    if (!response.ok || (typeof remote.id !== "number" && typeof remote.id !== "string")) {
      await deleteUploadedMedia(siteUrl, authorization, uploadedMedia.map((item) => item.id));
      const errorClass = response.status === 401 || response.status === 403 ? "authorization_failed" : "wordpress_rejected";
      await context.supabaseAdmin.from("cms_transfers").update({ status: "failed", publication_status: "delivery_failed", error_class: errorClass, error_detail: `WordPress returned ${response.status}.`, updated_at: new Date().toISOString() }).eq("integration_id", integrationId).eq("article_key", draft.articleKey);
      return json({ error: response.status === 401 || response.status === 403 ? "WordPress access needs attention. Reconnect it and try again." : "WordPress could not create the draft. Review the connection and try again." }, 502);
    }

    const remoteId = String(remote.id);
    const remoteEditUrl = wordpressEditUrl(siteUrl, remoteId);
    const fieldReport = wordpressFieldReport(draft.metaTitle, titleSuffix, uploadedMedia.length);
    const publicationStatus = remote.status === "future" ? "scheduled" : "delivered_draft";
    const draftMediaVerification = verifyDeliveredDraftMedia({
      featuredMedia: typeof remote.featured_media === "number" ? remote.featured_media : 0,
      contentHtml: typeof remote.content?.rendered === "string" ? remote.content.rendered : "",
    }, uploadedMedia);
    if (!draftMediaVerification.verified) {
      await context.supabaseAdmin.from("cms_transfers").update({
        status: "failed",
        publication_status: "delivery_failed",
        remote_id: remoteId,
        remote_edit_url: remoteEditUrl,
        remote_permalink: typeof remote.link === "string" ? remote.link : null,
        error_class: "media_readback_failed",
        error_detail: draftMediaVerification.reason,
        featured_media_id: uploadedMedia.find((item) => item.role === "featured")?.id ?? null,
        media_ids: uploadedMedia.map((item) => item.id),
        verification_evidence: { draftMediaVerified: false, reason: draftMediaVerification.reason },
        updated_at: new Date().toISOString(),
      }).eq("integration_id", integrationId).eq("article_key", draft.articleKey);
      return json({ error: "WordPress created a draft but did not preserve every required image. Rebound SEO blocked it from being marked ready.", remoteEditUrl }, 502);
    }
    const { error: completionError } = await context.supabaseAdmin.from("cms_transfers").update({
      status: "succeeded",
      publication_status: publicationStatus,
      remote_id: remoteId,
      remote_edit_url: remoteEditUrl,
      remote_permalink: typeof remote.link === "string" ? remote.link : null,
      remote_status: typeof remote.status === "string" ? remote.status : "draft",
      remote_modified_at: typeof remote.modified_gmt === "string" ? remote.modified_gmt : null,
      scheduled_for: draft.scheduledFor || null,
      delivered_fingerprint: contentFingerprint(draft.title, wordpressDraftPayload(draft, uploadedMedia).content),
      featured_media_id: uploadedMedia.find((item) => item.role === "featured")?.id ?? null,
      media_ids: uploadedMedia.map((item) => item.id),
      field_report: fieldReport,
      verification_evidence: { draftMediaVerified: true, featuredMediaId: uploadedMedia.find((item) => item.role === "featured")?.id ?? null, inlineMediaIds: uploadedMedia.filter((item) => item.role === "inline").map((item) => item.id) },
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("integration_id", integrationId).eq("article_key", draft.articleKey);
    if (completionError) return json({ error: "The WordPress draft was created, but Rebound SEO could not save its editor link. Check WordPress before trying again." }, 502);

    return json({ delivered: true, remoteEditUrl, updated: Boolean(updateRemoteId), publicationStatus, scheduledFor: draft.scheduledFor || null, fieldReport });
  }),
};
