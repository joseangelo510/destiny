import Link from "next/link";
import { SeoHistoryChart } from "@/components/seo-history-chart";
import { FeatureJourneyCallout } from "@/components/feature-journey-callout";
import { WorkspaceEmpty } from "@/components/workspace-empty";
import { WorkspaceShell } from "@/components/workspace-shell";
import { VerifiedResultSpotlight, selectVerifiedResult } from "@/components/verified-result-spotlight";
import type { HistoricalSeoPoint } from "@/lib/analytics/history";
import { getWorkspaceContext, list, providerResultFromMetrics, record } from "@/lib/workspace-context";

function syncedMetadata(integrations: Awaited<ReturnType<typeof getWorkspaceContext>>["integrations"], provider: string) {
  const integration = integrations.find((item) => item.provider === provider && item.status === "connected" && item.last_synced_at);
  return integration ? record(integration.metadata) : null;
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
  const connected = new Set(context.integrations.filter((item) => item.status === "connected").map((item) => item.provider));
  const metrics = context.metrics;
  const searchConsole = syncedMetadata(context.integrations, "google_search_console");
  const analytics = syncedMetadata(context.integrations, "google_analytics");
  const businessProfile = syncedMetadata(context.integrations, "google_business_profile");
  const youtube = syncedMetadata(context.integrations, "youtube");
  const hasFirstPartyData = Boolean(searchConsole || analytics || businessProfile || youtube);
  const verifiedResult = selectVerifiedResult({
    organicKeyEvents: Number(analytics?.organicKeyEvents ?? 0),
    searchClicks: Number(searchConsole?.clicks ?? 0),
    searchImpressions: Number(searchConsole?.impressions ?? 0),
  });
  return (
    <WorkspaceShell active="/analytics" eyebrow={context.website?.normalized_domain ?? "Destiny workspace"} title="SEO analytics" description="Real SEO metrics with their source shown—never an unexplained composite visibility score.">
      <FeatureJourneyCallout actionHref="#first-party-measurement" actionLabel="Check one source-backed signal" milestone="Signs it’s working" description="Use a trusted movement to decide whether to continue, adjust, or connect missing measurement." doneLooksLike="A metric is interpreted with its source and period visible." evidence="DataForSEO history or a timestamped connected-data snapshot." />
      {!metrics ? <WorkspaceEmpty title="Analytics begin after your audit" description="Run an audit to save keyword, traffic-estimate, content-gap, and technical metrics." /> : (
        <>
          <VerifiedResultSpotlight result={verifiedResult} />
          <div className="section-heading"><div><span>Search history</span><h2>How your visibility is changing</h2></div><small>DataForSEO · latest 3 available months</small></div>
          {historicalPerformance.length ? <section className="seo-history-grid">
            <SeoHistoryChart points={historicalPerformance} metric="organicTraffic" title="Estimated organic search traffic" description="The estimated visits your rankings could earn each month." />
            <SeoHistoryChart points={historicalPerformance} metric="rankingKeywords" title="Organic ranking keywords" description="The number of Google searches where your domain appeared in the top 100." />
          </section> : <section className="workspace-card history-unavailable"><strong>Search history is not available for this audit yet</strong><p>Run a fresh audit to request the latest DataForSEO historical ranking and traffic series.</p></section>}
          <section className="analytics-grid">
            {[
              [metrics.ranking_keywords, "Ranking keywords", `${metrics.new_keywords} new · ${metrics.lost_keywords} lost`],
              [Math.round(Number(metrics.estimated_organic_traffic)), "Estimated organic traffic", String(providerResult.sourceLabel ?? context.audit?.provider)],
              [metrics.content_gaps, "Content gaps", "Against the closest search competitor"],
              [metrics.critical_issues, "Critical issues", `${metrics.warnings} additional warnings`],
              [metrics.google_reviews, "Google reviews", connected.has("google_business_profile") ? "Business Profile connected" : "Connection required"],
              [context.quests.filter((item) => item.status === "complete").length, "Tasks completed", `${context.quests.length} total quests`],
            ].map(([value, label, detail]) => <article className="result-stat analytics-stat" key={String(label)}><strong>{Number(value).toLocaleString()}</strong><span>{label}</span><small>{detail}</small></article>)}
          </section>
          {hasFirstPartyData && <>
            <div className="section-heading"><div><span>Connected Google data</span><h2>First-party performance</h2></div><small>Latest read-only snapshots</small></div>
            <section className="analytics-grid">
              {searchConsole && <>
                <article className="result-stat analytics-stat"><strong>{Number(searchConsole.clicks ?? 0).toLocaleString()}</strong><span>Search clicks</span><small>{String(searchConsole.startDate ?? "")} to {String(searchConsole.endDate ?? "")}</small></article>
                <article className="result-stat analytics-stat"><strong>{Number(searchConsole.impressions ?? 0).toLocaleString()}</strong><span>Search impressions</span><small>Google Search Console</small></article>
                <article className="result-stat analytics-stat"><strong>{Number(searchConsole.position ?? 0).toFixed(1)}</strong><span>Average position</span><small>{String(searchConsole.selectedSiteUrl ?? "Synced property")}</small></article>
              </>}
              {analytics && <>
                <article className="result-stat analytics-stat"><strong>{Number(analytics.organicSessions ?? 0).toLocaleString()}</strong><span>Organic sessions</span><small>GA4 · last 28 complete days</small></article>
                <article className="result-stat analytics-stat"><strong>{Number(analytics.organicActiveUsers ?? 0).toLocaleString()}</strong><span>Organic active users</span><small>Google Analytics</small></article>
                <article className="result-stat analytics-stat"><strong>{Number(analytics.organicKeyEvents ?? 0).toLocaleString()}</strong><span>Organic key events</span><small>Website conversions</small></article>
              </>}
              {businessProfile && <>
                <article className="result-stat analytics-stat"><strong>{Number(businessProfile.reviewCount ?? 0).toLocaleString()}</strong><span>Google reviews</span><small>{Number(businessProfile.averageRating ?? 0).toFixed(1)} average rating</small></article>
              </>}
              {youtube && <>
                <article className="result-stat analytics-stat"><strong>{Number(youtube.periodViews ?? 0).toLocaleString()}</strong><span>YouTube views</span><small>Recent 28-day period</small></article>
                <article className="result-stat analytics-stat"><strong>{Number(youtube.subscribers ?? 0).toLocaleString()}</strong><span>YouTube subscribers</span><small>{Number(youtube.videoCount ?? 0).toLocaleString()} published videos</small></article>
              </>}
            </section>
          </>}
          <section className="workspace-card connection-callout" id="first-party-measurement"><div><strong>First-party measurement</strong><p>Connect Search Console, Google Analytics, Business Profile, and YouTube to add clicks, impressions, conversions, reviews, and video discovery.</p></div><Link className="primary-button workspace-action" href="/integrations">Manage connections</Link></section>
        </>
      )}
    </WorkspaceShell>
  );
}
