import { withSupabase } from "@supabase/server";
import { classifyWebflowFailure, prepareDraftBody, webflowCreateItemEndpoint, webflowEditUrl, webflowItemPayload } from "./logic.ts";

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

    const { data: stored, error: credentialError } = await context.supabaseAdmin.rpc("read_webflow_connection_credentials", {
      p_user_id: userId,
      p_website_id: draft.websiteId,
    });
    const secret = stored && typeof stored === "object" && !Array.isArray(stored) ? stored as ConnectionSecret : {};
    const credentials = secret.credentials && typeof secret.credentials === "object" && !Array.isArray(secret.credentials)
      ? secret.credentials as Record<string, unknown>
      : {};
    const integrationId = typeof secret.integration_id === "string" ? secret.integration_id : "";
    const apiToken = typeof credentials.api_token === "string" ? credentials.api_token : "";
    const collectionId = typeof credentials.collection_id === "string" ? credentials.collection_id : "";
    const titleField = typeof credentials.title_field === "string" && credentials.title_field ? credentials.title_field : "name";
    const bodyField = typeof credentials.body_field === "string" ? credentials.body_field : "";
    const siteShortName = typeof credentials.site_short_name === "string" ? credentials.site_short_name : "";
    if (credentialError || !integrationId || !apiToken || !collectionId || !bodyField) {
      return json({ error: "Connect Webflow before sending this article." }, 409);
    }

    const payload = webflowItemPayload(draft, titleField, bodyField);
    const hash = await contentHash(JSON.stringify(payload));
    const { data: existing } = await context.supabaseAdmin.from("cms_transfers")
      .select("id,status,content_hash,remote_edit_url,attempt_count")
      .eq("integration_id", integrationId)
      .eq("article_key", draft.articleKey)
      .maybeSingle();
    if (existing?.status === "succeeded") {
      if (existing.content_hash === hash && existing.remote_edit_url) {
        return json({ delivered: true, remoteEditUrl: existing.remote_edit_url, reused: true });
      }
      return json({ error: "This article is already in Webflow. Open the existing draft item to continue editing.", remoteEditUrl: existing.remote_edit_url }, 409);
    }
    if (existing?.status === "pending") return json({ error: "Destiny is already sending this article to Webflow." }, 409);

    // Claim the transfer atomically: an existing failed row is only claimed if
    // it is still failed (conditional update), and a new row relies on the
    // unique (integration_id, article_key) constraint. Concurrent retries lose
    // the claim and back off instead of double-posting to Webflow.
    if (existing) {
      const { data: claimed, error: claimError } = await context.supabaseAdmin.from("cms_transfers")
        .update({ status: "pending", content_hash: hash, error_class: null, error_detail: null, attempt_count: (typeof existing.attempt_count === "number" ? existing.attempt_count : 0) + 1, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .eq("status", "failed")
        .select("id");
      if (claimError || !claimed?.length) return json({ error: "Destiny is already sending this article to Webflow." }, 409);
    } else {
      const { error: insertError } = await context.supabaseAdmin.from("cms_transfers").insert({
        website_id: draft.websiteId,
        integration_id: integrationId,
        article_key: draft.articleKey,
        content_hash: hash,
        status: "pending",
        attempt_count: 1,
      });
      if (insertError) return json({ error: "Destiny is already sending this article to Webflow." }, 409);
    }

    let response: Response;
    try {
      response = await fetch(webflowCreateItemEndpoint(collectionId), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      await context.supabaseAdmin.from("cms_transfers").update({ status: "failed", error_class: "unreachable", error_detail: "Webflow did not respond.", updated_at: new Date().toISOString() }).eq("integration_id", integrationId).eq("article_key", draft.articleKey);
      return json({ error: "Destiny could not reach Webflow. Test the connection and try again." }, 502);
    }

    const remote = await response.json().catch(() => ({})) as { id?: unknown };
    if (!response.ok || typeof remote.id !== "string") {
      const errorClass = classifyWebflowFailure(response.status);
      await context.supabaseAdmin.from("cms_transfers").update({ status: "failed", error_class: errorClass, error_detail: `Webflow returned ${response.status}.`, updated_at: new Date().toISOString() }).eq("integration_id", integrationId).eq("article_key", draft.articleKey);
      return json({ error: errorClass === "authorization_failed" ? "Webflow access needs attention. Reconnect it and try again." : "Webflow could not create the draft item. Review the connection and try again." }, 502);
    }

    const remoteEditUrl = webflowEditUrl(siteShortName);
    const { error: completionError } = await context.supabaseAdmin.from("cms_transfers").update({
      status: "succeeded",
      remote_id: remote.id,
      remote_edit_url: remoteEditUrl,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("integration_id", integrationId).eq("article_key", draft.articleKey);
    if (completionError) return json({ error: "The Webflow draft item was created, but Destiny could not save its link. Check Webflow before trying again." }, 502);

    return json({ delivered: true, remoteEditUrl });
  }),
};
