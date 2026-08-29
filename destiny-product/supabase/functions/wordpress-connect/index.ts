import { withSupabase } from "@supabase/server";

type Body = { websiteId?: unknown; siteUrl?: unknown; username?: unknown; applicationPassword?: unknown };

function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
}

function prepare(value: Body) {
  if (typeof value.websiteId !== "string" || !value.websiteId) throw new Error("Complete onboarding before connecting WordPress.");
  const username = typeof value.username === "string" ? value.username.trim() : "";
  const applicationPassword = typeof value.applicationPassword === "string" ? value.applicationPassword.replace(/\s+/g, "") : "";
  if (!username || username.includes(":")) throw new Error("Enter a valid WordPress username or email.");
  if (applicationPassword.length < 8) throw new Error("Enter the WordPress Application Password.");
  const rawUrl = typeof value.siteUrl === "string" ? value.siteUrl.trim() : "";
  let url: URL;
  try { url = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`); }
  catch { throw new Error("Enter a valid WordPress website URL."); }
  if (url.protocol !== "https:") throw new Error("WordPress connections require HTTPS.");
  url.username = ""; url.password = ""; url.search = ""; url.hash = "";
  url.pathname = url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, "");
  const siteUrl = url.toString().replace(/\/$/, "");
  return { websiteId: value.websiteId, username, applicationPassword, siteUrl, endpoint: `${siteUrl}/wp-json/wp/v2/users/me?context=edit` };
}

export default {
  fetch: withSupabase({ auth: "user" }, async (request, context) => {
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
    let connection: ReturnType<typeof prepare>;
    try { connection = prepare(await request.json() as Body); }
    catch (cause) { return json({ error: cause instanceof Error ? cause.message : "Check the WordPress connection details." }, 400); }

    const userId = context.userClaims?.id;
    if (!userId) return json({ error: "Sign in again to continue." }, 401);
    const { data: website } = await context.supabase.from("websites").select("id").eq("id", connection.websiteId).maybeSingle();
    if (!website) return json({ error: "You do not have access to that website." }, 403);

    let verification: Response;
    try {
      verification = await fetch(connection.endpoint, {
        headers: { Authorization: `Basic ${btoa(`${connection.username}:${connection.applicationPassword}`)}`, Accept: "application/json" },
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      return json({ error: "Rebound SEO could not reach that WordPress REST API over HTTPS." }, 400);
    }
    const user = await verification.json().catch(() => ({})) as { id?: unknown; name?: unknown; link?: unknown };
    if (!verification.ok || (typeof user.id !== "number" && typeof user.id !== "string")) {
      return json({ error: "WordPress rejected the connection. Check the site URL, username, and Application Password." }, 400);
    }

    const site = await fetch(`${connection.siteUrl}/wp-json`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10_000) })
      .then((response) => response.ok ? response.json() : null)
      .catch(() => null) as { name?: unknown } | null;
    const siteName = typeof site?.name === "string" && site.name.trim() ? site.name.trim() : "";
    const { error } = await context.supabaseAdmin.rpc("store_cms_connection", {
      p_user_id: userId,
      p_website_id: connection.websiteId,
      p_provider: "wordpress",
      p_credentials: { site_url: connection.siteUrl, username: connection.username, application_password: connection.applicationPassword },
      p_metadata: { site_url: connection.siteUrl, display_name: typeof user.name === "string" ? user.name : connection.username, user_id: String(user.id), profile_url: typeof user.link === "string" ? user.link : null, site_name: siteName || null, estimated_title_suffix: siteName ? ` - ${siteName}` : null },
    });
    if (error) return json({ error: "Rebound SEO verified WordPress but could not save the secure connection." }, 502);
    return json({ connected: true, siteUrl: connection.siteUrl, displayName: typeof user.name === "string" ? user.name : connection.username });
  }),
};
