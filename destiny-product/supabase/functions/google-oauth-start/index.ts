import { withSupabase } from "@supabase/server";

const scopes = {
  google_search_console: ["https://www.googleapis.com/auth/webmasters.readonly"],
  google_analytics: ["https://www.googleapis.com/auth/analytics.readonly"],
  google_business_profile: ["https://www.googleapis.com/auth/business.manage"],
  youtube: [
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/yt-analytics.readonly",
  ],
} as const;

type Provider = keyof typeof scopes;

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export default {
  fetch: withSupabase({ auth: "user" }, async (request, context) => {
    if (request.method !== "POST") return Response.json({ error: "Method not allowed." }, { status: 405 });
    const body = await request.json().catch(() => ({})) as { provider?: unknown; websiteId?: unknown };
    if (typeof body.provider !== "string" || !(body.provider in scopes) || typeof body.websiteId !== "string") {
      return Response.json({ error: "Choose a supported Google connection and website." }, { status: 400 });
    }
    const provider = body.provider as Provider;
    const userId = context.userClaims?.id;
    if (!userId) return Response.json({ error: "Sign in again to continue." }, { status: 401 });

    const { data: website } = await context.supabase.from("websites").select("id").eq("id", body.websiteId).maybeSingle();
    if (!website) return Response.json({ error: "You do not have access to that website." }, { status: 403 });

    const clientId = Deno.env.get("GOOGLE_CLIENT_ID")?.trim();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim().replace(/\/$/, "");
    if (!clientId || !supabaseUrl) {
      return Response.json({ error: "Google OAuth is not configured yet." }, { status: 503 });
    }

    const random = new Uint8Array(32);
    crypto.getRandomValues(random);
    const state = base64Url(random);
    const stateHash = await sha256(state);
    const { error: stateError } = await context.supabaseAdmin.rpc("begin_google_oauth_state", {
      p_state_hash: stateHash,
      p_user_id: userId,
      p_website_id: website.id,
      p_provider: provider,
    });
    if (stateError) return Response.json({ error: stateError.message }, { status: 500 });

    const redirectUri = `${supabaseUrl}/functions/v1/google-oauth-callback`;
    const authorization = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authorization.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      access_type: "offline",
      include_granted_scopes: "true",
      prompt: "consent",
      scope: scopes[provider].join(" "),
      state,
    }).toString();

    return Response.json({ authorizationUrl: authorization.toString() }, { headers: { "Cache-Control": "no-store" } });
  }),
};
