import { AnalyticsDashboard } from "@/components/analytics-dashboard";
import { WorkspaceEmpty } from "@/components/workspace-empty";
import { WorkspaceShell } from "@/components/workspace-shell";
import { buildAnalyticsPeriods, buildRankMovers, rankingEstimateFallback } from "@/lib/analytics/dashboard";
import type { HistoricalSeoPoint } from "@/lib/analytics/history";
import { coachingTaskCopy, guidedTaskPath } from "@/lib/product/coach-experience";
import { getWorkspaceContext, list, providerResultFromMetrics, record } from "@/lib/workspace-context";

function syncedMetadata(integrations: Awaited<ReturnType<typeof getWorkspaceContext>>["integrations"], provider: string) {
  const integration = integrations.find((item) => item.provider === provider && item.status === "connected" && item.last_synced_at);
  return integration ? record(integration.metadata) : null;
}

function syncedAgo(value: string | null) {
  if (!value) return "not synced";
  const difference = Math.max(0, Date.now() - new Date(value).getTime());
  const hours = Math.floor(difference / 3_600_000);
  if (hours < 1) return "synced less than an hour ago";
  if (hours < 24) return `synced ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `synced ${days}d ago`;
}

export default async function AnalyticsPage() {
  const context = await getWorkspaceContext();
  const providerResult = providerResultFromMetrics(context.metrics);
  const historicalPerformance = list(providerResult.historicalPerformance).map(record).map((point) => ({
    year: Number(point.year ?? 0),
    month: Number(point.month ?? 0),
    organicTraffic: Number(point.organicTraffic ?? 0),
    rankingKeywords: Number(point.rankingKeywords ?? 0),
    top3Keywords: Number(point.top3Keywords ?? 0),
    top10Keywords: Number(point.top10Keywords ?? 0),
    newKeywords: Number(point.newKeywords ?? 0),
    lostKeywords: Number(point.lostKeywords ?? 0),
  })) satisfies HistoricalSeoPoint[];
  const metrics = context.metrics;
  if (!context.website) return <WorkspaceShell active="/analytics" eyebrow="Destiny workspace" title="How your site is doing" description="See how people find you and what to improve next."><WorkspaceEmpty title="Complete onboarding first" description="Add your website so Destiny knows which search and Analytics data belongs here." /></WorkspaceShell>;
  const searchConsole = syncedMetadata(context.integrations, "google_search_console");
  const analytics = syncedMetadata(context.integrations, "google_analytics");
  const [{ data: tracked }, { data: observations }] = await Promise.all([
    context.supabase.from("tracked_keywords").select("id,keyword").eq("website_id", context.website.id).neq("status", "paused").order("created_at"),
    context.supabase.from("rank_observations").select("tracked_keyword_id,observed_at,found,position").eq("website_id", context.website.id).order("observed_at", { ascending: false }).limit(2000),
  ]);
  const rankMovers = buildRankMovers(tracked ?? [], observations ?? []);
  const periods = buildAnalyticsPeriods({ searchConsole, analytics, movers: rankMovers });
  const firstOpenQuest = context.quests.find((quest) => quest.status !== "complete" && quest.status !== "skipped");
  const strongestMover = rankMovers.find((mover) => mover.tone === "up" && mover.currentPosition !== null && mover.currentPosition >= 4 && mover.currentPosition <= 20);
  const questCopy = firstOpenQuest ? coachingTaskCopy(firstOpenQuest) : null;
  const nextAction = strongestMover ? {
    title: `“${strongestMover.keyword}” moved to #${Math.round(strongestMover.currentPosition!)}. Review the page and choose the next optimization.`,
    href: "/rank-tracker",
    label: "Review ranking",
  } : firstOpenQuest && questCopy ? {
    title: questCopy.title,
    href: guidedTaskPath(firstOpenQuest),
    label: "Open coaching task",
  } : {
    title: "Choose the next keyword opportunity that fits your business.",
    href: "/keywords",
    label: "Review keywords",
  };
  const searchIntegration = context.integrations.find((item) => item.provider === "google_search_console");
  const analyticsIntegration = context.integrations.find((item) => item.provider === "google_analytics");
  const conversionCount = analytics
    ? Number(analytics.organicKeyEvents ?? record(record(analytics.periods)["30"]).organicKeyEvents ?? 0)
    : 0;
  const hasAnalyticsData = Boolean(metrics || searchConsole || analytics || (tracked?.length ?? 0) > 0);
  const estimate = rankingEstimateFallback(historicalPerformance);
  return (
    <WorkspaceShell active="/analytics" eyebrow={context.website.normalized_domain} title="How your site is doing" description="A clear path from being seen in search to earning useful visits and results.">
      {!hasAnalyticsData ? <WorkspaceEmpty title="Analytics begin after your audit" description="Run an audit or connect Google data to begin measuring search visibility and useful visits." /> : (
        <AnalyticsDashboard
          estimate={estimate ? { ...estimate, source: String(providerResult.sourceLabel ?? context.audit?.provider ?? "DataForSEO") } : null}
          nextAction={nextAction}
          periods={periods}
          rankMovers={rankMovers}
          sources={[
            { label: "Google Search Console", connected: Boolean(searchConsole), detail: searchIntegration?.last_synced_at ? syncedAgo(searchIntegration.last_synced_at) : "not connected" },
            { label: "Google Analytics", connected: Boolean(analytics), detail: analyticsIntegration?.last_synced_at ? syncedAgo(analyticsIntegration.last_synced_at) : "not connected" },
            { label: "Rank tracking", connected: (tracked?.length ?? 0) > 0, detail: (tracked?.length ?? 0) > 0 ? `${tracked?.length ?? 0} tracked` : "not started" },
            { label: "Conversions", connected: conversionCount > 0, detail: analytics ? `${conversionCount.toLocaleString("en-US")} organic key event${conversionCount === 1 ? "" : "s"}` : "Analytics not connected" },
          ]}
          trackedKeywordCount={tracked?.length ?? 0}
        />
      )}
    </WorkspaceShell>
  );
}
