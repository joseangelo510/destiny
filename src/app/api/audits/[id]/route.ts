import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) {
    return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  }

  const [{ data: audit, error }, { data: metrics }, { data: quest }] = await Promise.all([
    supabase.from("audits").select("id,status,progress,failure_message,created_at,completed_at").eq("id", id).maybeSingle(),
    supabase.from("audit_metrics").select("critical_issues,warnings,ranking_keywords,new_keywords,lost_keywords,content_gaps,google_reviews,raw_provider_payload").eq("audit_id", id).maybeSingle(),
    supabase.from("quests").select("title,category").eq("audit_id", id).order("created_at", { ascending: true }).limit(1).maybeSingle(),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!audit) return NextResponse.json({ error: "Audit not found." }, { status: 404 });
  const raw = metrics?.raw_provider_payload && typeof metrics.raw_provider_payload === "object" && !Array.isArray(metrics.raw_provider_payload)
    ? metrics.raw_provider_payload as Record<string, unknown>
    : {};
  const providerResult = raw.providerResult && typeof raw.providerResult === "object" && !Array.isArray(raw.providerResult)
    ? raw.providerResult as Record<string, unknown>
    : {};
  const storedDecision = providerResult.destinyDecision && typeof providerResult.destinyDecision === "object" && !Array.isArray(providerResult.destinyDecision)
    ? providerResult.destinyDecision as Record<string, unknown>
    : null;
  return NextResponse.json({
    audit,
    verification: metrics && quest ? {
      input: {
        auditComplete: 1,
        criticalIssues: metrics.critical_issues,
        warnings: metrics.warnings,
        rankingKeywords: metrics.ranking_keywords,
        newKeywords: metrics.new_keywords,
        lostKeywords: metrics.lost_keywords,
        contentGaps: metrics.content_gaps,
        reviewCount: metrics.google_reviews,
        // The worker evaluates the full contextual task pool. The coach shows
        // three core tasks first and reveals the remaining opportunities only
        // when the user asks for them.
        planTier: 3,
      },
      result: storedDecision,
      savedQuest: { title: quest.title, category: quest.category },
    } : null,
  }, { headers: { "Cache-Control": "no-store" } });
}
