import Link from "next/link";
import { WorkspaceEmpty } from "@/components/workspace-empty";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getWorkspaceContext, providerResultFromMetrics, record } from "@/lib/workspace-context";

function syncedMetadata(integrations: Awaited<ReturnType<typeof getWorkspaceContext>>["integrations"], provider: string) {
  const integration = integrations.find((item) => item.provider === provider && item.status === "connected" && item.last_synced_at);
  return integration ? record(integration.metadata) : null;
}

export default async function AnalyticsPage() {
  const context = await getWorkspaceContext();
  const providerResult = providerResultFromMetrics(context.metrics);
  const connected = new Set(context.integrations.filter((item) => item.status === "connected").map((item) => item.provider));
  const metrics = context.metrics;
  const searchConsole = syncedMetadata(context.integrations, "google_search_console");
  const analytics = syncedMetadata(context.integrations, "google_analytics");
  const businessProfile = syncedMetadata(context.integrations, "google_business_profile");
  const youtube = syncedMetadata(context.integrations, "youtube");
  const hasFirstPartyData = Boolean(searchConsole || analytics || businessProfile || youtube);
  return (
    <WorkspaceShell active="/analytics" eyebrow={context.website?.normalized_domain ?? "Destiny workspace"} title="SEO analytics" description="Real SEO metrics with their source shown—never an unexplained composite visibility score.">
      {!metrics ? <WorkspaceEmpty title="Analytics begin after your audit" description="Run an audit to save keyword, traffic-estimate, content-gap, and technical metrics." /> : (
        <>
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
          <section className="workspace-card connection-callout"><div><strong>First-party measurement</strong><p>Connect Search Console, Google Analytics, Business Profile, and YouTube to add clicks, impressions, conversions, reviews, and video discovery.</p></div><Link className="primary-button workspace-action" href="/integrations">Manage connections</Link></section>
        </>
      )}
    </WorkspaceShell>
  );
}
