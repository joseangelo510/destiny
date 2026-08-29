import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const providers = new Set(["google_search_console", "google_analytics", "google_business_profile", "youtube"]);

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { provider?: unknown; websiteId?: unknown; selectedResourceId?: unknown };
  if (typeof body.provider !== "string" || !providers.has(body.provider) || typeof body.websiteId !== "string") {
    return NextResponse.json({ error: "Choose a supported Google connection and website." }, { status: 400 });
  }
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  const { data, error } = await supabase.functions.invoke<{ error?: string; provider?: string; syncedAt?: string; selectionRequired?: boolean; summary?: Record<string, unknown> }>("google-sync", { body });
  if (error || !data?.syncedAt) {
    return NextResponse.json({ error: data?.error || error?.message || "Rebound SEO could not sync this Google connection." }, { status: 502 });
  }
  return NextResponse.json(data);
}
