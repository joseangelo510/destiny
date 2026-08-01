import { DestinyPrototype } from "@/components/destiny-prototype";
import { redirect } from "next/navigation";
import { calculateWeeklyStreak } from "@/lib/quests/streak";
import type { DestinyLogicResult } from "@/lib/logicaffeine";
import type { SeoAuditResult } from "@/lib/seo/types";
import { getWorkspaceContext, providerResultFromMetrics, record } from "@/lib/workspace-context";

function savedSeoAudit(value: Record<string, unknown>): SeoAuditResult | undefined {
  if ((value.source !== "demo" && value.source !== "dataforseo") || typeof value.domain !== "string") return undefined;
  if (!value.metrics || typeof value.metrics !== "object" || !Array.isArray(value.issues) || !Array.isArray(value.competitors) || !Array.isArray(value.keywords)) return undefined;
  return value as unknown as SeoAuditResult;
}

function savedDestinyLogic(providerResult: Record<string, unknown>): DestinyLogicResult | undefined {
  const value = record(providerResult.destinyDecision);
  if (
    typeof value.growthStage !== "string"
    || typeof value.decisionCode !== "string"
    || typeof value.weeklyQuest !== "string"
    || typeof value.questCategory !== "string"
    || typeof value.urgency !== "string"
    || typeof value.explanation !== "string"
  ) return undefined;
  return value as DestinyLogicResult;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string }>;
}) {
  const params = await searchParams;
  const context = await getWorkspaceContext();
  if (params.start === "1" || !context.website) redirect("/onboarding");
  const raw = record(context.metrics?.raw_provider_payload);
  const savedProviderResult = providerResultFromMetrics(context.metrics);
  const providerResult = savedSeoAudit(savedProviderResult);
  const destinyDecision = savedDestinyLogic(savedProviderResult);
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
      businessName: context.website.business_name,
      email: context.profile?.contact_email ?? "",
      website: context.website.url,
      business: context.website.products_services,
      customer: context.website.ideal_customer,
      competitors: context.competitors.map((competitor) => competitor.name || competitor.url).filter(Boolean).join(", "),
      standout: context.website.differentiation,
    } : undefined}
    initialLogic={destinyDecision ?? (growthStage && latestQuest ? {
      growthStage,
      decisionCode: "legacy_saved_decision",
      weeklyQuest: latestQuest.title,
      questCategory: latestQuest.category as DestinyLogicResult["questCategory"],
      urgency: "routine",
      explanation: "This recommendation was saved by an earlier Destiny rules version and remains available for continuity.",
    } : undefined)}
    initialMomentum={{
      completed: completedQuests.length,
      streak: calculateWeeklyStreak(completedQuests.map((quest) => quest.completed_at)),
      xp: completedQuests.reduce((total, quest) => total + quest.xp, 0),
    }}
    initialQuestXp={latestQuest?.xp}
    startOnboarding={false}
  />;
}
