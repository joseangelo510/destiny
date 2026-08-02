import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { auditId?: unknown; keyword?: unknown; decision?: unknown };
  const auditId = typeof body.auditId === "string" ? body.auditId : "";
  const keyword = typeof body.keyword === "string" ? body.keyword.trim().slice(0, 500) : "";
  const decision = body.decision === "approved" || body.decision === "declined" ? body.decision : null;
  if (!auditId || !keyword || !decision) return NextResponse.json({ error: "Choose approve or decline for a valid keyword." }, { status: 400 });

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  if (!userId) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });

  const { data: audit, error: auditError } = await supabase.from("audits").select("id,website_id,requested_by").eq("id", auditId).maybeSingle();
  if (auditError || !audit || audit.requested_by !== userId) return NextResponse.json({ error: "Audit not found." }, { status: 404 });

  const { data, error } = await supabase.from("keyword_decisions").upsert({
    audit_id: audit.id,
    website_id: audit.website_id,
    user_id: userId,
    keyword,
    decision,
  }, { onConflict: "audit_id,keyword" }).select("keyword,decision").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ decision: data });
}
