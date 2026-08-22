import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSafePublicWebsiteUrl, normalizeInternalUrl, verifyImplementedLink } from "@/lib/seo/interlinking";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (typeof claimsData?.claims?.sub !== "string") return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  const db = supabase as unknown as SupabaseClient;
  const { data: opportunity } = await db.from("interlink_opportunities").select("id,website_id,status,source_url,target_url").eq("id", id).maybeSingle();
  if (!opportunity) return NextResponse.json({ error: "Internal-link opportunity not found." }, { status: 404 });
  if (opportunity.status !== "done_claimed" && opportunity.status !== "verified") return NextResponse.json({ error: "Mark the link as added before asking Destiny to verify it." }, { status: 409 });
  const { data: website } = await supabase.from("websites").select("url").eq("id", opportunity.website_id).maybeSingle();
  const safeSource = website ? normalizeInternalUrl(opportunity.source_url, website.url) : null;
  const safeTarget = website ? normalizeInternalUrl(opportunity.target_url, website.url) : null;
  if (!website || !safeSource || !safeTarget || safeSource !== opportunity.source_url || safeTarget !== opportunity.target_url || !isSafePublicWebsiteUrl(safeSource)) {
    return NextResponse.json({ error: "Destiny blocked an unsafe or mismatched page URL." }, { status: 422 });
  }
  try {
    const response = await fetch(safeSource, {
      headers: { "user-agent": "DestinySEO/1.0 (+https://destiny-seo.replit.app)" },
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok || !(response.headers.get("content-type") ?? "").includes("text/html")) throw new Error("The source page did not return readable HTML.");
    const verification = verifyImplementedLink(await response.text(), safeSource, safeTarget);
    if (!verification.found) return NextResponse.json({
      error: "Destiny did not find the link on the live page yet. Confirm the page was published, then try again.",
      status: "done_claimed",
    }, { status: 422 });
    const verifiedAt = new Date().toISOString();
    const { error } = await db.from("interlink_opportunities").update({ status: "verified", verified_at: verifiedAt, verified_anchor: verification.anchor }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ status: "verified", verifiedAt, verifiedAnchor: verification.anchor });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Destiny could not re-check the live page." }, { status: 502 });
  }
}
