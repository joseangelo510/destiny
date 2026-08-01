import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const providers = new Set(["google_search_console", "google_analytics", "google_business_profile", "youtube"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const provider = url.searchParams.get("provider") ?? "";
  const websiteId = url.searchParams.get("websiteId") ?? "";
  if (!providers.has(provider) || !websiteId) {
    return NextResponse.redirect(new URL("/integrations?google=failed&reason=invalid_request", url.origin));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke<{ authorizationUrl?: string; error?: string }>("google-oauth-start", {
    body: { provider, websiteId },
  });
  if (error || !data?.authorizationUrl) {
    return NextResponse.redirect(new URL("/integrations?google=configuration_required", url.origin));
  }
  return NextResponse.redirect(data.authorizationUrl);
}
