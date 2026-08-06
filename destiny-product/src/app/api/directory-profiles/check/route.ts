import { NextResponse } from "next/server";
import { verifyDirectoryProfile } from "@/lib/distribution/listing-monitor";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { websiteId?: unknown; directoryKey?: unknown };
  const websiteId = typeof body.websiteId === "string" ? body.websiteId : "";
  const directoryKey = typeof body.directoryKey === "string" ? body.directoryKey : "";
  if (!websiteId || !directoryKey) return NextResponse.json({ error: "Choose a saved directory profile." }, { status: 400 });

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (typeof claimsData?.claims?.sub !== "string") return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  const { data: profile } = await supabase.from("directory_profiles").select("directory_key,profile_url").eq("website_id", websiteId).eq("directory_key", directoryKey).maybeSingle();
  if (!profile?.profile_url) return NextResponse.json({ error: "Save the public profile URL before checking it." }, { status: 400 });

  try {
    const result = await verifyDirectoryProfile(profile.directory_key, profile.profile_url);
    const checkedAt = new Date().toISOString();
    const { data, error } = await supabase.from("directory_profiles").update({
      http_status: result.httpStatus,
      last_checked_at: checkedAt,
      status: result.reachable ? "verified" : "saved",
    }).eq("website_id", websiteId).eq("directory_key", directoryKey).select("directory_key,profile_url,status,http_status,last_checked_at,public_rating,public_review_count").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ profile: data });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Destiny could not verify this public profile." }, { status: 502 });
  }
}
