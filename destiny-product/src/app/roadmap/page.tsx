import { redirect } from "next/navigation";
import { RoadmapExperience } from "@/components/roadmap-experience";
import { FeatureJourneyCallout } from "@/components/feature-journey-callout";
import { WorkspaceShell } from "@/components/workspace-shell";
import { buildSeasonSnapshot } from "@/lib/product/founder-journey";
import { buildSeoRoadmap, type RoadmapAnalytics, type RoadmapSearchConsole } from "@/lib/product/roadmap";
import { buildWeeklyProgressSummary } from "@/lib/quests/streak";
import { getWorkspaceContext, record } from "@/lib/workspace-context";

function connectedMetadata(context: Awaited<ReturnType<typeof getWorkspaceContext>>, provider: string) {
  const integration = context.integrations.find((item) => item.provider === provider && item.status === "connected" && item.last_synced_at);
  return integration ? record(integration.metadata) : null;
}

export default async function RoadmapPage() {
  const context = await getWorkspaceContext();
  if (!context.website) redirect("/onboarding");
  const searchConsole = connectedMetadata(context, "google_search_console") as RoadmapSearchConsole | null;
  const analytics = connectedMetadata(context, "google_analytics") as RoadmapAnalytics | null;
  const roadmap = await buildSeoRoadmap({
    auditComplete: context.audit?.status === "complete",
    quests: context.audit ? context.quests.filter((quest) => quest.audit_id === context.audit?.id) : [],
    searchConsole,
    analytics,
  });
  const weekly = await buildWeeklyProgressSummary(context.quests);
  const season = buildSeasonSnapshot({
    activeWeeks: weekly.lifetimeActiveWeeks,
    quests: context.audit ? context.quests.filter((quest) => quest.audit_id === context.audit?.id) : [],
    verifiedSignals: roadmap.nodes.filter((node) => node.kind === "outcome" && node.state === "complete").length,
  });

  return <WorkspaceShell active="/roadmap" eyebrow={context.website.normalized_domain} title="Your visibility journey" description="See where you are, where you are going, and the one useful step to take next.">
    <FeatureJourneyCallout actionHref="/this-week" actionLabel="Open this week’s next step" milestone="Your visibility journey" description="Use the roadmap to understand sequence, then return to one concrete action." doneLooksLike="The current milestone points to one open task rather than a new dashboard choice." evidence="Saved task state and connected outcome evidence remain separate." />
    <RoadmapExperience roadmap={roadmap} season={season} weekly={weekly} />
  </WorkspaceShell>;
}
