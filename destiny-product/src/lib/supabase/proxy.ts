import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeInternalPath } from "@/lib/auth/redirect";
import {
  ACTIVE_WEBSITE_COOKIE,
  activeWebsiteCookieOptions,
  isWebsiteId,
  shouldPersistWebsiteSelection,
} from "@/lib/workspace-selection";
import type { Database } from "./database.types";

export async function updateSession(request: NextRequest) {
  const requestedWebsiteId = request.nextUrl.searchParams.get("site");
  const persistWebsiteSelection = isWebsiteId(requestedWebsiteId)
    && shouldPersistWebsiteSelection(request.headers);
  if (isWebsiteId(requestedWebsiteId)) request.cookies.set(ACTIVE_WEBSITE_COOKIE, requestedWebsiteId);
  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headersToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headersToSet).forEach(([name, value]) =>
            response.headers.set(name, value),
          );
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const isPublicPath = request.nextUrl.pathname === "/" ||
    request.nextUrl.pathname === "/login" ||
    request.nextUrl.pathname.startsWith("/login/") ||
    request.nextUrl.pathname === "/auth" ||
    request.nextUrl.pathname.startsWith("/auth/");

  if (!data?.claims && !isPublicPath) {
    const isInteractiveGoogleStart = request.method === "GET" && request.nextUrl.pathname === "/api/integrations/google/start";
    if (request.nextUrl.pathname.startsWith("/api/") && !isInteractiveGoogleStart) {
      return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
    }
    const requestedPath = safeInternalPath(`${request.nextUrl.pathname}${request.nextUrl.search}`);
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", requestedPath);
    return NextResponse.redirect(url);
  }

  if (data?.claims && persistWebsiteSelection) {
    response.cookies.set(ACTIVE_WEBSITE_COOKIE, requestedWebsiteId, activeWebsiteCookieOptions);
  }
  return response;
}
