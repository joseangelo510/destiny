import { NextResponse } from "next/server";
import { baseDirectories, directoryProfileMatches } from "@/lib/distribution/recommendations";
import { normalizeWebsite } from "@/lib/seo/url";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { websiteId?: unknown; directoryKey?: unknown; profileUrl?: unknown };
  const websiteId = typeof body.websiteId === "string" ? body.websiteId : "";
  const directoryKey = typeof body.directoryKey === "string" ? body.directoryKey : "";
  const rawUrl = typeof body.profileUrl === "string" ? body.profileUrl.trim() : "";
  if (!websiteId || !baseDirectories.some((item) => item.key === directoryKey)) {
    return NextResponse.json({ error: "Choose a supported directory." }, { status: 400 });
  }

  let profileUrl: string | null = null;
  if (rawUrl) {
    try { profileUrl = normalizeWebsite(rawUrl).url; }
    catch { return NextResponse.json({ error: "Enter a valid public profile URL." }, { status: 400 }); }
    if (!directoryProfileMatches(directoryKey, profileUrl)) return NextResponse.json({ error: `Enter the matching ${baseDirectories.find((item) => item.key === directoryKey)?.name ?? "directory"} profile URL.` }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (typeof claimsData?.claims?.sub !== "string") return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  const { data: website } = await supabase.from("websites").select("id,organization_id").eq("id", websiteId).maybeSingle();
  if (!website) return NextResponse.json({ error: "Website not found." }, { status: 404 });

  const { data, error } = await supabase.from("directory_profiles").upsert({
    organization_id: website.organization_id,
    website_id: website.id,
    directory_key: directoryKey,
    profile_url: profileUrl,
    status: profileUrl ? "saved" : "not_started",
    http_status: null,
    last_checked_at: null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "website_id,directory_key" }).select("directory_key,profile_url,status,http_status,last_checked_at,public_rating,public_review_count").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile: data });
}
