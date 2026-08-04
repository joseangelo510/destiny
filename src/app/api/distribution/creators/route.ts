import { NextResponse } from "next/server";
import { normalizeWebsite } from "@/lib/seo/url";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { websiteId?: unknown; topics?: unknown };
  const websiteId = typeof body.websiteId === "string" ? body.websiteId : "";
  const topics = Array.isArray(body.topics) ? body.topics.filter((item): item is string => typeof item === "string" && item.trim().length >= 2).slice(0, 3) : [];
  if (!websiteId || !topics.length) return NextResponse.json({ error: "Choose at least one priority keyword first." }, { status: 400 });

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (typeof claimsData?.claims?.sub !== "string") return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  const { data: website } = await supabase.from("websites").select("id,normalized_domain,plan_tier").eq("id", websiteId).maybeSingle();
  if (!website) return NextResponse.json({ error: "Website not found." }, { status: 404 });
  if (website.plan_tier !== "moderate" && website.plan_tier !== "super_growth") {
    return NextResponse.json({ error: "Upgrade to unlock live creator recommendations." }, { status: 403 });
  }
  const { data: competitors } = await supabase.from("competitors").select("url").eq("website_id", website.id);
  const competitorDomains = (competitors ?? []).flatMap((item) => {
    if (!item.url) return [];
    try { return [normalizeWebsite(item.url).domain]; } catch { return []; }
  });
  const { data, error } = await supabase.functions.invoke("seo-research", { body: {
    kind: "creators",
    topics,
    locationName: "United States",
    excludeDomains: [website.normalized_domain, ...competitorDomains],
  } });
  if (error || !data) return NextResponse.json({ error: error?.message || "Destiny could not complete creator discovery." }, { status: 502 });
  return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
}
