import { redirect } from "next/navigation";
import { RoadmapExperience } from "@/components/roadmap-experience";
import { WorkspaceShell } from "@/components/workspace-shell";
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
  const roadmap = buildSeoRoadmap({
    auditComplete: context.audit?.status === "complete",
    quests: context.quests,
    searchConsole,
    analytics,
  });
  const weekly = buildWeeklyProgressSummary(context.quests);

  return <WorkspaceShell active="/roadmap" eyebrow={context.website.normalized_domain} title="Your SEO roadmap" description="A truthful journey from completed work to verified search outcomes. Destiny reveals the route without promising dates or results it cannot prove.">
    <RoadmapExperience roadmap={roadmap} weekly={weekly} />
  </WorkspaceShell>;
}
