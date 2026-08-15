import { NextResponse } from "next/server";
import { keywordEvidenceFromResearch } from "@/lib/content/saved-keyword-merge";
import { INITIAL_KEYWORD_APPROVAL_TARGET } from "@/lib/product/plan-horizon";
import { selectQuickKeywordApprovals } from "@/lib/seo/quick-keyword-approval";
import { normalizeTrackedKeyword } from "@/lib/seo/rank-tracker";
import { createClient } from "@/lib/supabase/server";

const DECISION_REASONS = new Set(["wrong_audience", "not_offered", "too_competitive", "already_covered", "not_now"]);
const PROVIDER_INTENTS = new Set(["transactional", "commercial", "navigational", "informational"]);
const SEARCH_INTENTS = new Set(["conversion", "consideration", "awareness"]);
type KeywordDecision = { keyword: string; decision: "approved" | "declined"; reason: string | null };
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const boundedMetric = (value: unknown, minimum: number, maximum: number) => {
  const metric = Number(value);
  return Number.isFinite(metric) && metric >= minimum && metric <= maximum ? Math.round(metric) : null;
};
const allowedValue = (value: unknown, allowed: Set<string>) => {
  const normalized = typeof value === "string" ? value.toLowerCase() : "";
  return allowed.has(normalized) ? normalized : null;
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { auditId?: unknown; action?: unknown; approveRecommended?: unknown; keyword?: unknown; decision?: unknown; reason?: unknown; decisions?: unknown; evidence?: unknown };
  const researchEvidence = keywordEvidenceFromResearch(body.evidence);
  const auditId = typeof body.auditId === "string" ? body.auditId : "";
  const restore = body.action === "restore";
  const approveRecommended = body.approveRecommended === true;
  const keyword = typeof body.keyword === "string" ? body.keyword.trim().slice(0, 500) : "";
  const decision = body.decision === "approved" || body.decision === "declined" ? body.decision : null;
  const reason = typeof body.reason === "string" && DECISION_REASONS.has(body.reason) ? body.reason : null;
  const batch = Array.isArray(body.decisions) ? body.decisions.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as { keyword?: unknown; decision?: unknown; reason?: unknown };
    const batchKeyword = typeof candidate.keyword === "string" ? candidate.keyword.trim().slice(0, 500) : "";
    const batchDecision = candidate.decision === "approved" || candidate.decision === "declined" ? candidate.decision : null;
    const batchReason = typeof candidate.reason === "string" && DECISION_REASONS.has(candidate.reason) ? candidate.reason : null;
    return batchKeyword && batchDecision ? [{ keyword: batchKeyword, decision: batchDecision as "approved" | "declined", reason: batchReason }] : [];
  }).slice(0, 50) : [];
  let requestedDecisions: KeywordDecision[] = batch.length ? batch : keyword && decision ? [{ keyword, decision, reason }] : [];
  if (!auditId || (!restore && !approveRecommended && !requestedDecisions.length) || (restore && !keyword)) return NextResponse.json({ error: "Choose approve, decline, or restore for at least one valid keyword." }, { status: 400 });

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  if (!userId) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });

  const { data: audit, error: auditError } = await supabase.from("audits").select("id,website_id,requested_by").eq("id", auditId).maybeSingle();
  if (auditError || !audit || audit.requested_by !== userId) return NextResponse.json({ error: "Audit not found." }, { status: 404 });
  const { data: website, error: websiteError } = await supabase.from("websites").select("organization_id").eq("id", audit.website_id).maybeSingle();
  if (websiteError || !website) return NextResponse.json({ error: websiteError?.message || "Website not found." }, { status: 404 });

  if (restore) {
    const normalizedKeyword = normalizeTrackedKeyword(keyword);
    const { error: preferenceError } = await supabase.from("keyword_preferences").delete()
      .eq("website_id", audit.website_id)
      .eq("user_id", userId)
      .eq("normalized_keyword", normalizedKeyword);
    if (preferenceError) return NextResponse.json({ error: preferenceError.message }, { status: 500 });
    const { error: pauseError } = await supabase.from("tracked_keywords").update({ status: "paused" })
      .eq("website_id", audit.website_id)
      .eq("source", "strategy")
      .in("normalized_keyword", [normalizedKeyword]);
    if (pauseError) return NextResponse.json({ error: `The keyword returned to review, but rank tracking could not pause: ${pauseError.message}` }, { status: 500 });
    return NextResponse.json({ restored: true, keyword });
  }

  const { data: metrics, error: metricsError } = await supabase.from("audit_metrics").select("raw_provider_payload").eq("audit_id", audit.id).maybeSingle();
  if (metricsError) return NextResponse.json({ error: metricsError.message }, { status: 500 });

  if (approveRecommended) {
    const { data: existing, error: existingError } = await supabase.from("keyword_preferences").select("keyword,decision").eq("website_id", audit.website_id);
    if (existingError) return NextResponse.json({ error: existingError.message || "Keyword recommendations could not be loaded." }, { status: 500 });
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
    requestedDecisions = selection.approvals.map((item) => ({ keyword: item, decision: "approved" as const, reason: null }));
    if (!requestedDecisions.length) return NextResponse.json({ decisions: [], trackingStarted: [], alreadyApproved: true });
  }

  const rows = requestedDecisions.map((item) => ({
    audit_id: audit.id,
    website_id: audit.website_id,
    user_id: userId,
    keyword: item.keyword,
    decision: item.decision,
    reason: item.reason,
  }));
  const { data, error } = await supabase.from("keyword_decisions").upsert(rows, { onConflict: "audit_id,keyword" }).select("keyword,decision,reason");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const providerResult = record(record(metrics?.raw_provider_payload).providerResult);
  const providerKeywords = Array.isArray(providerResult.keywords) ? providerResult.keywords.map(record) : [];
  const preferenceRows = requestedDecisions.map((item) => {
    const normalizedKeyword = normalizeTrackedKeyword(item.keyword);
    const poolEvidence = providerKeywords.find((candidate) => normalizeTrackedKeyword(String(candidate.keyword || "")) === normalizedKeyword);
    // Preserve live research evidence for phrases approved from Keyword Research
    // that were never part of the audit recommendation pool.
    const fromResearch = !poolEvidence && requestedDecisions.length === 1 && researchEvidence ? {
      providerIntent: researchEvidence.providerIntent ?? undefined,
      searchVolume: researchEvidence.searchVolume ?? undefined,
      difficulty: researchEvidence.difficulty ?? undefined,
    } : {};
    const evidence = poolEvidence ?? fromResearch as Record<string, unknown>;
    return {
      organization_id: website.organization_id,
      website_id: audit.website_id,
      user_id: userId,
      source_audit_id: audit.id,
      keyword: item.keyword,
      normalized_keyword: normalizedKeyword,
      decision: item.decision,
      reason: item.reason,
      theme_id: typeof evidence.themeId === "string" ? evidence.themeId : null,
      theme_label: typeof evidence.themeLabel === "string" ? evidence.themeLabel : null,
      provider_intent: allowedValue(evidence.providerIntent ?? evidence.intent, PROVIDER_INTENTS),
      search_intent: allowedValue(evidence.searchIntent, SEARCH_INTENTS),
      search_volume: boundedMetric(evidence.searchVolume, 0, 2_147_483_647),
      difficulty: boundedMetric(evidence.difficulty, 0, 100),
      priority_score: boundedMetric(evidence.priorityScore, 0, 100),
    };
  });
  const { error: preferenceError } = await supabase.from("keyword_preferences").upsert(preferenceRows, { onConflict: "website_id,normalized_keyword" });
  if (preferenceError) return NextResponse.json({ error: `The audit decision was saved, but the website preference could not update: ${preferenceError.message}` }, { status: 500 });
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
