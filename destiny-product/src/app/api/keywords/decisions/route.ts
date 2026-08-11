import { NextResponse } from "next/server";
import { INITIAL_KEYWORD_APPROVAL_TARGET } from "@/lib/product/plan-horizon";
import { selectQuickKeywordApprovals } from "@/lib/seo/quick-keyword-approval";
import { normalizeTrackedKeyword } from "@/lib/seo/rank-tracker";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { auditId?: unknown; approveRecommended?: unknown; keyword?: unknown; decision?: unknown; decisions?: unknown };
  const auditId = typeof body.auditId === "string" ? body.auditId : "";
  const approveRecommended = body.approveRecommended === true;
  const keyword = typeof body.keyword === "string" ? body.keyword.trim().slice(0, 500) : "";
  const decision = body.decision === "approved" || body.decision === "declined" ? body.decision : null;
  const batch = Array.isArray(body.decisions) ? body.decisions.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as { keyword?: unknown; decision?: unknown };
    const batchKeyword = typeof candidate.keyword === "string" ? candidate.keyword.trim().slice(0, 500) : "";
    const batchDecision = candidate.decision === "approved" || candidate.decision === "declined" ? candidate.decision : null;
    return batchKeyword && batchDecision ? [{ keyword: batchKeyword, decision: batchDecision as "approved" | "declined" }] : [];
  }).slice(0, 50) : [];
  let requestedDecisions: Array<{ keyword: string; decision: "approved" | "declined" }> = batch.length ? batch : keyword && decision ? [{ keyword, decision }] : [];
  if (!auditId || (!approveRecommended && !requestedDecisions.length)) return NextResponse.json({ error: "Choose approve or decline for at least one valid keyword." }, { status: 400 });

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  if (!userId) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });

  const { data: audit, error: auditError } = await supabase.from("audits").select("id,website_id,requested_by").eq("id", auditId).maybeSingle();
  if (auditError || !audit || audit.requested_by !== userId) return NextResponse.json({ error: "Audit not found." }, { status: 404 });

  if (approveRecommended) {
    const [{ data: metrics, error: metricsError }, { data: existing, error: existingError }] = await Promise.all([
      supabase.from("audit_metrics").select("raw_provider_payload").eq("audit_id", audit.id).maybeSingle(),
      supabase.from("keyword_decisions").select("keyword,decision").eq("audit_id", audit.id),
    ]);
    if (metricsError || existingError) return NextResponse.json({ error: metricsError?.message || existingError?.message || "Keyword recommendations could not be loaded." }, { status: 500 });
    const selection = selectQuickKeywordApprovals(
      metrics?.raw_provider_payload,
      (existing ?? []).flatMap((item) => item.decision === "approved" || item.decision === "declined"
        ? [{ keyword: item.keyword, decision: item.decision }]
        : []),
      INITIAL_KEYWORD_APPROVAL_TARGET,
    );
    if (!selection.ready) return NextResponse.json({
      error: "Destiny needs you to review these recommendations before approving them.",
      approvedCount: selection.approvedCount,
      requiredApprovals: INITIAL_KEYWORD_APPROVAL_TARGET,
    }, { status: 409 });
    requestedDecisions = selection.approvals.map((item) => ({ keyword: item, decision: "approved" as const }));
    if (!requestedDecisions.length) return NextResponse.json({ decisions: [], trackingStarted: [], alreadyApproved: true });
  }

  const rows = requestedDecisions.map((item) => ({
    audit_id: audit.id,
    website_id: audit.website_id,
    user_id: userId,
    keyword: item.keyword,
    decision: item.decision,
  }));
  const { data, error } = await supabase.from("keyword_decisions").upsert(rows, { onConflict: "audit_id,keyword" }).select("keyword,decision");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const approved = requestedDecisions.filter((item) => item.decision === "approved");
  const declined = requestedDecisions.filter((item) => item.decision === "declined");
  if (approved.length) {
    const { error: trackerError } = await supabase.from("tracked_keywords").upsert(approved.map((item) => ({
      website_id: audit.website_id,
      created_by: userId,
      keyword: item.keyword,
      normalized_keyword: normalizeTrackedKeyword(item.keyword),
      source: "strategy",
    })), {
      onConflict: "website_id,normalized_keyword,location_code,language_code,device",
      ignoreDuplicates: true,
    });
    if (trackerError) return NextResponse.json({ error: `Keyword decisions were saved, but rank tracking could not start: ${trackerError.message}` }, { status: 500 });
    const { error: resumeError } = await supabase.from("tracked_keywords").update({ status: "pending", next_check_at: new Date().toISOString(), last_error: null })
      .eq("website_id", audit.website_id)
      .eq("source", "strategy")
      .eq("status", "paused")
      .in("normalized_keyword", approved.map((item) => normalizeTrackedKeyword(item.keyword)));
    if (resumeError) return NextResponse.json({ error: `Keyword decisions were saved, but paused tracking could not resume: ${resumeError.message}` }, { status: 500 });
  }
  if (declined.length) {
    const { error: pauseError } = await supabase.from("tracked_keywords").update({ status: "paused" })
      .eq("website_id", audit.website_id)
      .eq("source", "strategy")
      .in("normalized_keyword", declined.map((item) => normalizeTrackedKeyword(item.keyword)));
    if (pauseError) return NextResponse.json({ error: `Keyword decisions were saved, but strategy-only tracking could not pause: ${pauseError.message}` }, { status: 500 });
  }
  return NextResponse.json({ decisions: data, trackingStarted: approved.map((item) => item.keyword) });
}
