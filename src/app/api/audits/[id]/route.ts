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
    supabase.from("audits").select("id,status,progress,failure_message,completed_at").eq("id", id).maybeSingle(),
    supabase.from("audit_metrics").select("critical_issues,ranking_keywords,content_gaps,google_reviews,raw_provider_payload").eq("audit_id", id).maybeSingle(),
    supabase.from("quests").select("title").eq("audit_id", id).order("created_at", { ascending: true }).limit(1).maybeSingle(),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!audit) return NextResponse.json({ error: "Audit not found." }, { status: 404 });
  const raw = metrics?.raw_provider_payload && typeof metrics.raw_provider_payload === "object" && !Array.isArray(metrics.raw_provider_payload)
    ? metrics.raw_provider_payload as Record<string, unknown>
    : {};
  return NextResponse.json({
    audit,
    verification: metrics && quest ? {
      input: {
        auditComplete: 1,
        criticalIssues: metrics.critical_issues,
        rankingKeywords: metrics.ranking_keywords,
        contentGaps: metrics.content_gaps,
        reviewCount: metrics.google_reviews,
      },
      growthStage: typeof raw.growthStage === "string" ? raw.growthStage : null,
      weeklyQuest: quest.title,
    } : null,
  }, { headers: { "Cache-Control": "no-store" } });
}
