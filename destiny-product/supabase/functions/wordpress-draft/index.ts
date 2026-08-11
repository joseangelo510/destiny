import { withSupabase } from "@supabase/server";
import { prepareDraftBody, wordpressDraftPayload, wordpressEditUrl } from "./logic.ts";

type ConnectionSecret = {
  integration_id?: unknown;
  credentials?: unknown;
};

function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
}

async function contentHash(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
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
    const integrationId = typeof secret.integration_id === "string" ? secret.integration_id : "";
    const siteUrl = typeof credentials.site_url === "string" ? credentials.site_url.replace(/\/+$/, "") : "";
    const username = typeof credentials.username === "string" ? credentials.username : "";
    const applicationPassword = typeof credentials.application_password === "string" ? credentials.application_password : "";
    if (credentialError || !integrationId || !siteUrl || !username || !applicationPassword) {
      return json({ error: "Connect WordPress before sending this article." }, 409);
    }

    const hash = await contentHash(JSON.stringify(wordpressDraftPayload(draft)));
    const { data: existing } = await context.supabaseAdmin.from("cms_transfers")
      .select("id,status,content_hash,remote_edit_url")
      .eq("integration_id", integrationId)
      .eq("article_key", draft.articleKey)
      .maybeSingle();
    if (existing?.status === "succeeded") {
      if (existing.content_hash === hash && existing.remote_edit_url) {
        return json({ delivered: true, remoteEditUrl: existing.remote_edit_url, reused: true });
      }
      return json({ error: "This article is already in WordPress. Open the existing draft to continue editing.", remoteEditUrl: existing.remote_edit_url }, 409);
    }
    if (existing?.status === "pending") return json({ error: "Destiny is already sending this article to WordPress." }, 409);

    const pendingWrite = existing
      ? context.supabaseAdmin.from("cms_transfers").update({ status: "pending", content_hash: hash, error_class: null, error_detail: null, attempt_count: 1, updated_at: new Date().toISOString() }).eq("id", existing.id)
      : context.supabaseAdmin.from("cms_transfers").insert({
        website_id: draft.websiteId,
        integration_id: integrationId,
        article_key: draft.articleKey,
        content_hash: hash,
        status: "pending",
        attempt_count: 1,
      });
    const { error: pendingError } = await pendingWrite;
    if (pendingError) return json({ error: "Destiny is already sending this article to WordPress." }, 409);

    let response: Response;
    try {
      response = await fetch(`${siteUrl}/wp-json/wp/v2/posts`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${username}:${applicationPassword}`)}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(wordpressDraftPayload(draft)),
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      await context.supabaseAdmin.from("cms_transfers").update({ status: "failed", error_class: "unreachable", error_detail: "WordPress did not respond.", updated_at: new Date().toISOString() }).eq("integration_id", integrationId).eq("article_key", draft.articleKey);
      return json({ error: "Destiny could not reach WordPress. Test the connection and try again." }, 502);
    }

    const remote = await response.json().catch(() => ({})) as { id?: unknown };
    if (!response.ok || (typeof remote.id !== "number" && typeof remote.id !== "string")) {
      const errorClass = response.status === 401 || response.status === 403 ? "authorization_failed" : "wordpress_rejected";
      await context.supabaseAdmin.from("cms_transfers").update({ status: "failed", error_class: errorClass, error_detail: `WordPress returned ${response.status}.`, updated_at: new Date().toISOString() }).eq("integration_id", integrationId).eq("article_key", draft.articleKey);
      return json({ error: response.status === 401 || response.status === 403 ? "WordPress access needs attention. Reconnect it and try again." : "WordPress could not create the draft. Review the connection and try again." }, 502);
    }

    const remoteId = String(remote.id);
    const remoteEditUrl = wordpressEditUrl(siteUrl, remoteId);
    const { error: completionError } = await context.supabaseAdmin.from("cms_transfers").update({
      status: "succeeded",
      remote_id: remoteId,
      remote_edit_url: remoteEditUrl,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("integration_id", integrationId).eq("article_key", draft.articleKey);
    if (completionError) return json({ error: "The WordPress draft was created, but Destiny could not save its editor link. Check WordPress before trying again." }, 502);

    return json({ delivered: true, remoteEditUrl });
  }),
};
