import { redirect } from "next/navigation";
import { GamePlanView } from "@/components/game-plan-view";
import { WorkspaceEmpty } from "@/components/workspace-empty";
import { WorkspaceShell } from "@/components/workspace-shell";
import { buildGamePlan } from "@/lib/product/game-plan";
import { selectUsableAuditKeywords } from "@/lib/seo/audit-keywords";
import { getWorkspaceContext, list, providerResultFromMetrics, record } from "@/lib/workspace-context";

export default async function ResultsPage() {
  const context = await getWorkspaceContext();
  if (!context.website) redirect("/onboarding");

  if (!context.audit) {
    return (
      <WorkspaceShell active="/results" eyebrow={context.website.normalized_domain} title="90-Day SEO Game Plan" description="Your executive strategy will appear here after Destiny completes the first audit.">
        <WorkspaceEmpty title="Your Game Plan is being prepared" description="Run the initial website analysis so Destiny can build a focused quarter from verified evidence." />
      </WorkspaceShell>
    );
  }

  const provider = providerResultFromMetrics(context.metrics);
  const usableKeywords = selectUsableAuditKeywords(provider.keywords).length;
  const raw = record(context.metrics?.raw_provider_payload);
  const savedKeywords = list(raw.keywordStrategy);
  const { data: keywordDecisions } = await context.supabase
    .from("keyword_preferences")
    .select("decision")
    .eq("website_id", context.website.id);
  const approvedKeywords = (keywordDecisions ?? []).filter((decision) => decision.decision === "approved").length;
  const plan = await buildGamePlan({
    approvedKeywords,
    auditCompletedAt: context.audit.completed_at,
    businessName: context.website.business_name,
    criticalIssues: Number(context.metrics?.critical_issues ?? 0),
    estimatedOrganicTraffic: Number(context.metrics?.estimated_organic_traffic ?? 0),
    normalizedDomain: context.website.normalized_domain,
    rankingKeywords: Number(context.metrics?.ranking_keywords ?? 0),
    tasks: context.quests.map((task) => ({ category: task.category, status: task.status, task_type: task.task_type })),
    usableKeywords: Math.max(usableKeywords, savedKeywords.length),
  });
  const lastUpdated = new Date(context.audit.completed_at ?? context.audit.created_at).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <WorkspaceShell
      active="/results"
      eyebrow={context.website.normalized_domain}
      title="90-Day SEO Game Plan"
      description="What Destiny will prioritize, why it matters, and what progress could realistically look like this quarter."
    >
      <GamePlanView auditHref={`/audits/${context.audit.id}`} lastUpdated={lastUpdated} plan={plan} />
    </WorkspaceShell>
  );
}
