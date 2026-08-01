import { withSupabase } from "@supabase/server";

function redirectTo(siteUrl: string, params: Record<string, string>) {
  const url = new URL("/integrations", siteUrl);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return Response.redirect(url.toString(), 302);
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export default {
  fetch: withSupabase({ auth: "none" }, async (request, context) => {
    const siteUrl = Deno.env.get("DESTINY_SITE_URL")?.trim() || "http://localhost:3000";
    if (request.method !== "GET") return redirectTo(siteUrl, { google: "failed", reason: "method" });
    const url = new URL(request.url);
    if (url.searchParams.get("error")) return redirectTo(siteUrl, { google: "cancelled" });

    const code = url.searchParams.get("code") ?? "";
    const state = url.searchParams.get("state") ?? "";
    if (!code || state.length < 32 || state.length > 128) {
      return redirectTo(siteUrl, { google: "failed", reason: "invalid_response" });
    }

    try {
      const stateHash = await sha256(state);
      const { data: stateData, error: stateError } = await context.supabaseAdmin.rpc("consume_google_oauth_state", { p_state_hash: stateHash });
      if (stateError || !stateData || typeof stateData !== "object") throw new Error("OAuth state is invalid or expired.");
      const saved = stateData as { userId?: unknown; websiteId?: unknown; provider?: unknown };
      if (typeof saved.userId !== "string" || typeof saved.websiteId !== "string" || typeof saved.provider !== "string") {
        throw new Error("OAuth state is incomplete.");
      }

      const clientId = Deno.env.get("GOOGLE_CLIENT_ID")?.trim();
      const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")?.trim();
      const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim().replace(/\/$/, "");
      if (!clientId || !clientSecret || !supabaseUrl || !Deno.env.get("DESTINY_SITE_URL")) {
        return redirectTo(siteUrl, { google: "configuration_required" });
      }
      const redirectUri = `${supabaseUrl}/functions/v1/google-oauth-callback`;
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
        signal: AbortSignal.timeout(20_000),
      });
      const token = await tokenResponse.json() as Record<string, unknown>;
      if (!tokenResponse.ok || typeof token.access_token !== "string") throw new Error("Google token exchange failed.");
      const expiresIn = typeof token.expires_in === "number" ? token.expires_in : 3600;
      const tokenForVault = { ...token, expires_at: new Date(Date.now() + (expiresIn * 1000)).toISOString() };
      const grantedScopes = typeof token.scope === "string" ? token.scope.split(" ").filter(Boolean) : [];
      const { error: storeError } = await context.supabaseAdmin.rpc("store_google_oauth_connection", {
        p_user_id: saved.userId,
        p_website_id: saved.websiteId,
        p_provider: saved.provider,
        p_scopes: grantedScopes,
        p_token: tokenForVault,
      });
      if (storeError) throw new Error(storeError.message);

      return redirectTo(siteUrl, { google: "connected", provider: saved.provider });
    } catch (cause) {
      console.error("Google OAuth callback failed", cause instanceof Error ? cause.message : "Unknown error");
      return redirectTo(siteUrl, { google: "failed", reason: "callback" });
    }
  }),
};
