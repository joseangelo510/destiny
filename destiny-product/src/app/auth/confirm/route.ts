import { NextResponse } from "next/server";
import { safeInternalPath } from "@/lib/auth/redirect";
import { siteRedirectUrl } from "@/lib/auth/site-url";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeInternalPath(url.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(siteRedirectUrl(process.env.NEXT_PUBLIC_SITE_URL, request.url, next));
  }
  return NextResponse.redirect(siteRedirectUrl(process.env.NEXT_PUBLIC_SITE_URL, request.url, "/auth/error"));
}
