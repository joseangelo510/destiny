import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { auditId?: unknown; keyword?: unknown; decision?: unknown; decisions?: unknown };
  const auditId = typeof body.auditId === "string" ? body.auditId : "";
  const keyword = typeof body.keyword === "string" ? body.keyword.trim().slice(0, 500) : "";
  const decision = body.decision === "approved" || body.decision === "declined" ? body.decision : null;
  const batch = Array.isArray(body.decisions) ? body.decisions.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as { keyword?: unknown; decision?: unknown };
    const batchKeyword = typeof candidate.keyword === "string" ? candidate.keyword.trim().slice(0, 500) : "";
    const batchDecision = candidate.decision === "approved" || candidate.decision === "declined" ? candidate.decision : null;
    return batchKeyword && batchDecision ? [{ keyword: batchKeyword, decision: batchDecision }] : [];
  }).slice(0, 50) : [];
  const requestedDecisions = batch.length ? batch : keyword && decision ? [{ keyword, decision }] : [];
  if (!auditId || !requestedDecisions.length) return NextResponse.json({ error: "Choose approve or decline for at least one valid keyword." }, { status: 400 });

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  if (!userId) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });

  const { data: audit, error: auditError } = await supabase.from("audits").select("id,website_id,requested_by").eq("id", auditId).maybeSingle();
  if (auditError || !audit || audit.requested_by !== userId) return NextResponse.json({ error: "Audit not found." }, { status: 404 });

  const rows = requestedDecisions.map((item) => ({
    audit_id: audit.id,
    website_id: audit.website_id,
    user_id: userId,
    keyword: item.keyword,
    decision: item.decision,
  }));
  const { data, error } = await supabase.from("keyword_decisions").upsert(rows, { onConflict: "audit_id,keyword" }).select("keyword,decision");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ decisions: data });
}
