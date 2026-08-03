import { GoogleIntegrationAction } from "@/components/google-integration-action";
import { FeatureJourneyCallout } from "@/components/feature-journey-callout";
import { WorkspaceEmpty } from "@/components/workspace-empty";
import { WorkspaceShell } from "@/components/workspace-shell";
import { WordPressIntegrationAction } from "@/components/wordpress-integration-action";
import { getWorkspaceContext, record } from "@/lib/workspace-context";

const providers = [
  { id: "google_search_console", name: "Google Search Console", description: "Queries, clicks, impressions, positions, and indexed pages" },
  { id: "google_analytics", name: "Google Analytics", description: "Organic sessions, landing pages, events, and website conversions" },
  { id: "google_business_profile", name: "Google Business Profile", description: "Local discovery, calls, direction requests, and reviews" },
  { id: "youtube", name: "YouTube", description: "Search discovery, video performance, and content opportunities" },
] as const;

const providerNames = Object.fromEntries(providers.map((provider) => [provider.id, provider.name]));

type IntegrationsPageProps = {
  searchParams: Promise<{ google?: string; provider?: string; reason?: string }>;
};

function syncSummary(provider: string, value: unknown) {
  const metadata = record(value);
  if (provider === "google_search_console" && metadata.syncedAt) return `${Number(metadata.clicks ?? 0).toLocaleString()} clicks · ${Number(metadata.impressions ?? 0).toLocaleString()} impressions`;
  if (provider === "google_analytics" && metadata.syncedAt) return `${Number(metadata.organicSessions ?? 0).toLocaleString()} organic sessions · ${Number(metadata.organicKeyEvents ?? 0).toLocaleString()} key events`;
  if (provider === "google_business_profile" && metadata.syncedAt) return `${Number(metadata.reviewCount ?? 0).toLocaleString()} reviews · ${Number(metadata.averageRating ?? 0).toFixed(1)} average rating`;
  if (provider === "youtube" && metadata.syncedAt) return `${Number(metadata.periodViews ?? 0).toLocaleString()} recent views · ${Number(metadata.subscribers ?? 0).toLocaleString()} subscribers`;
  return "Connect and sync to import first-party data.";
}

export default async function IntegrationsPage({ searchParams }: IntegrationsPageProps) {
  const params = await searchParams;
  const context = await getWorkspaceContext();
  const connectedProvider = params.provider ? providerNames[params.provider] : undefined;
  return (
    <WorkspaceShell active="/integrations" eyebrow={context.website?.normalized_domain ?? "Destiny workspace"} title="Connections" description="Bring first-party Google data into Destiny and connect an approved content workflow to your CMS. Credentials remain server-side.">
      <FeatureJourneyCallout milestone="Signs it’s working" description="Search Console and Analytics let Destiny confirm real impressions, clicks, rankings, and conversions." />
      {!context.website ? <WorkspaceEmpty title="Complete onboarding first" description="Destiny needs a saved website before an external account can be connected to it." /> : (
        <>
        <section className="integration-list" id="google-setup">
          {params.google === "connected" && <div className="integration-banner success"><strong>{connectedProvider ?? "Google"} connected</strong><p>Destiny securely saved the connection. The account will be used only for the website you selected.</p></div>}
          {params.google === "cancelled" && <div className="integration-banner"><strong>Connection cancelled</strong><p>No Google account was connected and no credentials were saved.</p></div>}
          {params.google === "configuration_required" && <div className="integration-banner warning"><strong>Google setup is not active yet</strong><p>The server still needs the approved Google OAuth client credentials. Nothing was connected or exposed.</p></div>}
          {params.google === "failed" && <div className="integration-banner error"><strong>Google connection was not completed</strong><p>Please try again. If this repeats, review the Google consent-screen and redirect-URL configuration.</p></div>}
          {providers.map((provider) => {
            const saved = context.integrations.find((item) => item.provider === provider.id);
            const connected = saved?.status === "connected";
            const href = `/api/integrations/google/start?provider=${provider.id}&websiteId=${context.website.id}`;
            return <article className="integration-row" key={provider.id}><span className="integration-logo">G</span><div><strong>{provider.name}</strong><p>{provider.description}</p><p className="integration-summary">{syncSummary(provider.id, saved?.metadata)}</p>{saved?.last_synced_at && <small>Last synced {new Date(saved.last_synced_at).toLocaleString()}</small>}</div><span className={`status-chip ${connected ? "" : "amber"}`}>{saved?.status ?? "Not connected"}</span><GoogleIntegrationAction connected={connected} connectHref={href} provider={provider.id} websiteId={context.website.id} /></article>;
          })}
          <div className="configuration-note"><strong>Secure Google authorization</strong><p>Each button requests only the read access needed for that product. Google credentials stay encrypted on the server, and Destiny never reports a connection as live until Google completes authorization.</p></div>
        </section>
        <section className="integration-list" id="cms-setup">
          <div className="workspace-card-heading"><div><strong>Content management system</strong><small>Approved drafts only</small></div><span>WordPress</span></div>
          {(() => {
            const wordpress = context.integrations.find((item) => item.provider === "wordpress");
            const connected = wordpress?.status === "connected";
            const metadata = record(wordpress?.metadata);
            return <article className="integration-row"><span className="integration-logo">W</span><div><strong>WordPress</strong><p>Verify a revocable Application Password, then hand approved drafts to WordPress without exposing credentials in the browser.</p><p className="integration-summary">{connected ? `${String(metadata.display_name || "WordPress editor")} · ${String(metadata.site_url || "Connected site")}` : "Connect after reviewing the first SEO draft."}</p></div><span className={`status-chip ${connected ? "" : "amber"}`}>{connected ? "Connected" : "Not connected"}</span><WordPressIntegrationAction connected={connected} savedSiteUrl={typeof metadata.site_url === "string" ? metadata.site_url : undefined} websiteId={context.website.id} /></article>;
          })()}
          <div className="configuration-note"><strong>Human approval stays required</strong><p>Connecting WordPress does not auto-publish. Destiny keeps Draft → Review & approve → CMS as separate steps.</p></div>
        </section>
        </>
      )}
    </WorkspaceShell>
  );
}
