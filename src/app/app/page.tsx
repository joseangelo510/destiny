import { DestinyPrototype } from "@/components/destiny-prototype";
import { calculateWeeklyStreak } from "@/lib/quests/streak";
import type { SeoAuditResult } from "@/lib/seo/types";
import { getWorkspaceContext, providerResultFromMetrics, record } from "@/lib/workspace-context";

function savedSeoAudit(value: Record<string, unknown>): SeoAuditResult | undefined {
  if ((value.source !== "demo" && value.source !== "dataforseo") || typeof value.domain !== "string") return undefined;
  if (!value.metrics || typeof value.metrics !== "object" || !Array.isArray(value.issues) || !Array.isArray(value.competitors) || !Array.isArray(value.keywords)) return undefined;
  return value as unknown as SeoAuditResult;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string }>;
}) {
  const params = await searchParams;
  const context = await getWorkspaceContext();
  const raw = record(context.metrics?.raw_provider_payload);
  const providerResult = savedSeoAudit(providerResultFromMetrics(context.metrics));
  const growthStage = typeof raw.growthStage === "string" ? raw.growthStage : undefined;
  const latestQuest = context.quests.find((quest) => quest.audit_id === context.audit?.id) ?? context.quests[0];
  const completedQuests = context.quests.filter((quest) => quest.status === "complete");

  return <DestinyPrototype
    hasWorkspace={Boolean(context.website)}
    initialAudit={providerResult}
    initialAuditFailure={context.audit?.failure_message ?? undefined}
    initialAuditId={context.audit?.id}
    initialAuditStatus={context.audit?.status}
    initialForm={context.website ? {
      firstName: context.profile?.first_name ?? "",
      lastName: context.profile?.last_name ?? "",
      email: context.profile?.contact_email ?? "",
      website: context.website.url,
      business: context.website.products_services,
      customer: context.website.ideal_customer,
      competitors: context.competitors.map((competitor) => competitor.name || competitor.url).filter(Boolean).join(", "),
      standout: context.website.differentiation,
    } : undefined}
    initialLogic={growthStage && latestQuest ? { growthStage, weeklyQuest: latestQuest.title } : undefined}
    initialMomentum={{
      completed: completedQuests.length,
      streak: calculateWeeklyStreak(completedQuests.map((quest) => quest.completed_at)),
      xp: completedQuests.reduce((total, quest) => total + quest.xp, 0),
    }}
    initialQuestXp={latestQuest?.xp}
    startOnboarding={params.start === "1"}
  />;
}
