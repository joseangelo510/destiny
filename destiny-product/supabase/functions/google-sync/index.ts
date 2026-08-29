import { withSupabase } from "@supabase/server";
import { syncBusinessProfile, syncGoogleAnalytics, syncSearchConsole, syncYouTube } from "./google.ts";

const providers = new Set(["google_search_console", "google_analytics", "google_business_profile", "youtube"]);

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

async function freshAccessToken(token: Record<string, unknown>) {
  const refreshToken = typeof token.refresh_token === "string" ? token.refresh_token : "";
  if (!refreshToken) {
    if (typeof token.access_token !== "string") throw new Error("Google credentials are incomplete. Reconnect this account.");
    return { accessToken: token.access_token, refreshedToken: null };
  }
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID")?.trim();
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")?.trim();
  if (!clientId || !clientSecret) throw new Error("Google OAuth is not configured yet.");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
    signal: AbortSignal.timeout(20_000),
  });
  const refreshed = await response.json() as Record<string, unknown>;
  if (!response.ok || typeof refreshed.access_token !== "string") throw new Error("Google authorization expired. Reconnect this account.");
  const expiresIn = typeof refreshed.expires_in === "number" ? refreshed.expires_in : 3600;
  return {
    accessToken: refreshed.access_token,
    refreshedToken: { ...refreshed, refresh_token: refreshToken, expires_at: new Date(Date.now() + (expiresIn * 1000)).toISOString() },
  };
}

export default {
  fetch: withSupabase({ auth: "user" }, async (request, context) => {
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
    const body = await request.json().catch(() => ({})) as { provider?: unknown; websiteId?: unknown; selectedResourceId?: unknown };
    if (typeof body.provider !== "string" || !providers.has(body.provider) || typeof body.websiteId !== "string") {
      return json({ error: "Choose a supported Google connection and website." }, 400);
    }
    const userId = context.userClaims?.id;
    if (!userId) return json({ error: "Sign in again to continue." }, 401);

    const [{ data: website }, { data: integration }] = await Promise.all([
      context.supabase.from("websites").select("id,normalized_domain").eq("id", body.websiteId).maybeSingle(),
      context.supabase.from("integrations").select("id,provider,status,scopes,updated_at,external_account_id,metadata").eq("website_id", body.websiteId).eq("provider", body.provider).maybeSingle(),
    ]);
    if (!website) return json({ error: "You do not have access to that website." }, 403);
    if (!integration) return json({ error: "Connect this Google product before syncing it." }, 409);
    if (integration.status === "syncing") {
      const startedAt = new Date(integration.updated_at).getTime();
      if (Number.isFinite(startedAt) && Date.now() - startedAt < 10 * 60 * 1000) {
        return json({ error: "This connection is already syncing. Wait for it to finish before trying again." }, 409);
      }
      await context.supabaseAdmin.from("integrations").update({ status: "connected" }).eq("id", integration.id).eq("status", "syncing");
    } else if (integration.status !== "connected") {
      return json({ error: "Reconnect this Google product before syncing it." }, 409);
    }

    const { data: claimed } = await context.supabaseAdmin.from("integrations")
      .update({ status: "syncing", updated_at: new Date().toISOString() })
      .eq("id", integration.id)
      .eq("status", "connected")
      .select("id")
      .maybeSingle();
    if (!claimed) return json({ error: "This connection is already syncing. Wait for it to finish before trying again." }, 409);

    try {
      const { data: tokenData, error: tokenError } = await context.supabaseAdmin.rpc("read_google_oauth_credentials", {
        p_integration_id: integration.id,
        p_user_id: userId,
      });
      if (tokenError || !tokenData || typeof tokenData !== "object" || Array.isArray(tokenData)) throw new Error("Google credentials were not found. Reconnect this account.");
      const { accessToken, refreshedToken } = await freshAccessToken(tokenData as Record<string, unknown>);
      const requestedResourceId = typeof body.selectedResourceId === "string" && body.selectedResourceId.trim()
        ? body.selectedResourceId.trim()
        : typeof integration.external_account_id === "string" && integration.external_account_id.trim()
        ? integration.external_account_id.trim()
        : null;
      const result = integration.provider === "google_search_console"
        ? await syncSearchConsole(accessToken, website.normalized_domain, requestedResourceId)
        : integration.provider === "google_analytics"
        ? await syncGoogleAnalytics(accessToken, website.normalized_domain, requestedResourceId)
        : integration.provider === "google_business_profile"
        ? await syncBusinessProfile(accessToken, website.normalized_domain)
        : await syncYouTube(accessToken);
      if (refreshedToken) {
        const { error: refreshStoreError } = await context.supabaseAdmin.rpc("store_google_oauth_connection", {
          p_user_id: userId,
          p_website_id: website.id,
          p_provider: integration.provider,
          p_scopes: integration.scopes,
          p_token: refreshedToken,
        });
        if (refreshStoreError) throw new Error("Rebound SEO could not rotate the Google credential.");
      }
      const syncedAt = new Date().toISOString();
      const { error: updateError } = await context.supabaseAdmin.from("integrations").update({
        external_account_id: result.externalAccountId,
        metadata: { ...result.metadata, provider: integration.provider, syncedAt },
        last_synced_at: syncedAt,
        status: "connected",
      }).eq("id", integration.id);
      if (updateError) throw new Error("Rebound SEO could not save the Google data snapshot.");
      return json({ provider: integration.provider, syncedAt, selectionRequired: result.metadata.selectionRequired === true, summary: result.metadata });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Rebound SEO could not sync this Google connection.";
      console.error("Google sync failed", integration.provider, message);
      const reconnectRequired = /authorization|credentials|expired|reconnect|revoked/i.test(message);
      await context.supabaseAdmin.from("integrations").update({ status: reconnectRequired ? "reconnect_required" : "connected" }).eq("id", integration.id);
      return json({ error: message }, 502);
    }
  }),
};
