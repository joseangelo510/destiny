import { WebflowIntegrationAction } from "./webflow-integration-action";
import { WordPressIntegrationAction } from "./wordpress-integration-action";

const CMS_DESTINATIONS = [
  { name: "Shopify", mark: "S", description: "Send approved articles to your Shopify blog as unpublished content." },
  { name: "Wix", mark: "W", description: "Move approved articles into the Wix Blog workflow." },
  { name: "Squarespace", mark: "S", description: "Prepare a complete publishing handoff for your Squarespace blog." },
  { name: "GoDaddy Website Builder", mark: "G", description: "Prepare approved content for your GoDaddy website editor." },
  { name: "Joomla", mark: "J", description: "Send approved articles into your Joomla content workflow." },
  { name: "Weebly", mark: "W", description: "Prepare approved content for your Weebly site." },
  { name: "Duda", mark: "D", description: "Create approved content for your Duda-managed website." },
  { name: "Drupal", mark: "D", description: "Send approved content into the correct Drupal content type." },
  { name: "Sitecore", mark: "S", description: "Prepare approved content for a Sitecore editorial workflow." },
  { name: "Other CMS", mark: "+", description: "Use a guided HTML and Markdown handoff when a direct connector is unavailable." },
] as const;

const AI_DESTINATIONS = [
  { name: "Lovable", mark: "L", description: "Connect through the project repository or supported publishing workflow." },
  { name: "Replit", mark: "R", description: "Connect the project repository so Destiny can propose approved content changes." },
  { name: "v0", mark: "v0", description: "Use the connected GitHub repository and a reviewable pull request." },
  { name: "Bolt", mark: "B", description: "Connect through the project repository when it is available." },
  { name: "Base44", mark: "B", description: "Connect through the builder or its exported project when supported." },
  { name: "GitHub / code-based site", mark: "GH", description: "Create a reviewable content branch or pull request instead of changing the live site." },
  { name: "ChatGPT / Claude-built website", mark: "AI", description: "The AI created the site; Destiny connects to where its files or content are managed." },
] as const;

function PlannedDestination({ destination }: { destination: { name: string; mark: string; description: string } }) {
  return <article className="publishing-destination-card">
    <div className="publishing-destination-topline"><span className="integration-logo">{destination.mark}</span><span className="status-chip amber">Planned</span></div>
    <strong>{destination.name}</strong>
    <p>{destination.description}</p>
    <button className="secondary-button" disabled type="button">Coming soon</button>
  </article>;
}

export function PublishingDestinations({
  wordpressConnected,
  wordpressDisplayName,
  wordpressSiteUrl,
  webflowConnected,
  webflowSiteName,
  webflowCollectionName,
  websiteId,
}: {
  wordpressConnected: boolean;
  wordpressDisplayName?: string;
  wordpressSiteUrl?: string;
  webflowConnected: boolean;
  webflowSiteName?: string;
  webflowCollectionName?: string;
  websiteId: string;
}) {
  const webflowSummary = webflowConnected && (webflowSiteName || webflowCollectionName)
    ? [webflowSiteName, webflowCollectionName].filter(Boolean).join(" · ")
    : undefined;
  return <section className="publishing-destinations" id="publishing-destinations">
    <div className="workspace-card-heading integration-section-heading"><div><strong>Publishing destinations</strong><small>Choose where Destiny should place content after you review and approve it. Destiny will create drafts—not publish without you.</small></div></div>

    <div className="publishing-destination-featured integration-row">
      <span className="integration-logo">W</span>
      <div><strong>WordPress</strong><p>Verify a revocable Application Password. Draft transfer is the first live publishing workflow Destiny is completing.</p><p className="integration-summary">{wordpressConnected ? `${wordpressDisplayName || "WordPress editor"} · ${wordpressSiteUrl || "Verified site"}` : "Connect your WordPress site securely."}</p></div>
      <span className={`status-chip ${wordpressConnected ? "" : "amber"}`}>{wordpressConnected ? "Verified" : "Available now"}</span>
      <WordPressIntegrationAction connected={wordpressConnected} savedSiteUrl={wordpressSiteUrl} websiteId={websiteId} />
    </div>

    <div className="publishing-destination-featured integration-row">
      <span className="integration-logo">W</span>
      <div><strong>Webflow</strong><p>Verify a site API token with CMS access, then choose the collection where Destiny creates draft items—never published items.</p><p className="integration-summary">{webflowConnected ? webflowSummary || "Verified Webflow CMS collection" : "Connect your Webflow site securely."}</p></div>
      <span className={`status-chip ${webflowConnected ? "" : "amber"}`}>{webflowConnected ? "Verified" : "Available now"}</span>
      <WebflowIntegrationAction connected={webflowConnected} savedSummary={webflowSummary} websiteId={websiteId} />
    </div>

    <div className="publishing-destination-group">
      <div className="publishing-destination-group-heading"><strong>CMS and website platforms</strong><small>Popular destinations included in the Destiny connection roadmap.</small></div>
      <div className="publishing-destination-grid">{CMS_DESTINATIONS.map((destination) => <PlannedDestination destination={destination} key={destination.name} />)}</div>
    </div>

    <div className="publishing-destination-group">
      <div className="publishing-destination-group-heading"><strong>AI-built and code-based websites</strong><small>Destiny connects to the builder, repository, or CMS that actually controls the live website.</small></div>
      <div className="publishing-destination-grid">{AI_DESTINATIONS.map((destination) => <PlannedDestination destination={destination} key={destination.name} />)}</div>
      <details className="ai-publishing-path workspace-card">
        <summary>How will an AI-built website connect?</summary>
        <div><strong>Where do you make changes to this website?</strong><ul><li>WordPress, Wix, Webflow, Shopify, or another CMS</li><li>Lovable, Replit, v0, Bolt, or Base44</li><li>GitHub, Vercel, Netlify, or a developer-managed repository</li><li>I’m not sure—let Destiny inspect the website</li></ul><p>Destiny will use that answer to choose the real publishing connection. It will never claim that ChatGPT or Claude is the CMS.</p></div>
      </details>
    </div>
  </section>;
}
