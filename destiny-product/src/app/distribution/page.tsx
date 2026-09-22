import { DistributionCommunity } from "@/components/distribution-community";
import { loadWebsiteEntitlement } from "@/lib/billing/website-entitlement";
import { WorkspaceLink as Link } from "@/components/workspace-link";
import { CreatorDiscovery } from "@/components/creator-discovery";
import { FeatureJourneyCallout } from "@/components/feature-journey-callout";
import { WorkspaceEmpty } from "@/components/workspace-empty";
import { WorkspaceShell } from "@/components/workspace-shell";
import {
  baseDirectories,
  creatorProspects,
  recommendedDirectories,
  recommendedSocialChannels,
} from "@/lib/distribution/recommendations";
import { latestVerifiedShareTarget } from "@/lib/distribution/share-target";
import { getWorkspaceContext, list, providerResultFromMetrics, record } from "@/lib/workspace-context";
import type { SupabaseClient } from "@supabase/supabase-js";

export default async function DistributionPage() {
  const context = await getWorkspaceContext();
  const providerResult = providerResultFromMetrics(context.metrics);
  const opportunities = list(providerResult.distributionOpportunities).map(record);
  const publishers = creatorProspects(list(providerResult.publisherOpportunities).map(record));
  const { data: transferRows } = context.website
    ? await (context.supabase as unknown as SupabaseClient).rpc("read_cms_transfer_states", { p_website_id: context.website.id })
    : { data: [] };
  const shareTarget = latestVerifiedShareTarget(
    Array.isArray(transferRows) ? transferRows.map(record) : [],
    context.website?.url ?? "",
    context.website?.business_name ?? "our team",
  );
  const articleUrl = shareTarget.url;
  const articleTitle = shareTarget.title;
  const linkedInShare = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(articleUrl)}`;
  const xShare = `https://x.com/intent/post?text=${encodeURIComponent(`${articleTitle} ${articleUrl}`)}`;
  const facebookShare = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(articleUrl)}`;
  const businessContext = [context.website?.business_name, context.website?.products_services, context.website?.ideal_customer, context.website?.market].filter(Boolean).join(" ");
  const entitlement = await loadWebsiteEntitlement(context.website?.id);
  const paid = entitlement.canRunPaidWork;
  const social = recommendedSocialChannels(businessContext);
  const directorySuggestions = recommendedDirectories(context.website?.products_services ?? "").filter((suggestion) => !baseDirectories.some((base) => base.key === suggestion.key));
  const visibleCreators = publishers;
  const creatorTopics = list(providerResult.keywords).map(record)
    .filter((item) => item.essential === true || Number(item.priorityTier ?? 9) <= 2)
    .map((item) => String(item.keyword ?? "")).filter(Boolean).slice(0, 3);

  return (
    <WorkspaceShell active="/distribution" eyebrow={context.website?.normalized_domain ?? "Rebound SEO workspace"} title="Distribute this week’s work" description="Use four practical channels: helpful community replies, social sharing, creator outreach, and trusted directory or review profiles.">
      <FeatureJourneyCallout actionHref="#community" actionLabel="Review saved conversations" milestone="Build visibility" description="Contribute one helpful answer where a real customer is already looking." doneLooksLike="A useful response, share, outreach draft, or saved public profile is recorded." evidence="An attached URL or saved draft; Search Console separately confirms impressions and clicks." />
      {!context.audit ? <WorkspaceEmpty title="Run an audit first" description="Rebound SEO needs your search context before it can recommend relevant distribution opportunities." /> : (
        <div className="distribution-sections">
          <section id="community"><DistributionCommunity opportunities={opportunities} websiteId={context.website!.id} /></section>

          <section className="workspace-card distribution-section" id="social">
            <div className="distribution-section-heading"><div><span className="eyebrow">2 · Social sharing</span><h2>Share the approved article with your network</h2><p>Connect the article to a firsthand observation instead of posting a generic link.</p></div><strong>Goal: LinkedIn + X + Facebook</strong></div>
            <div className={`configuration-note ${shareTarget.verifiedArticle ? "success" : ""}`}><strong>{shareTarget.verifiedArticle ? "Verified live article selected" : "No verified live article yet"}</strong><p>{shareTarget.verifiedArticle ? articleUrl : "Rebound SEO will use the website homepage until a CMS transfer is verified as published. It will never label a draft as live."}</p></div>
            <div className="social-share-actions"><a className="primary-button" href={linkedInShare} rel="noreferrer" target="_blank">Share on LinkedIn ↗</a><a className="secondary-button" href={xShare} rel="noreferrer" target="_blank">Share on X ↗</a><a className="secondary-button" href={facebookShare} rel="noreferrer" target="_blank">Share on Facebook ↗</a><Link className="text-button" href="/content">Review articles first</Link></div>
            <RecommendationPanel canManageBilling={entitlement.canManageBilling} paid={paid} title="Get more social recommendations">
              {social.additional.length ? social.additional.map((channel) => <article key={channel.name}><strong>{channel.name}</strong><p>{channel.detail}</p></article>) : <p>Rebound SEO needs more business context before recommending an additional channel.</p>}
            </RecommendationPanel>
          </section>

          <section className="workspace-card distribution-section" id="outreach">
            <div className="distribution-section-heading"><div><span className="eyebrow">3 · Creator outreach <b className="beta-badge">Beta</b></span><h2>Find niche creators already covering your priority topics</h2><p>Review public sources before outreach. Rebound SEO filters out major media and vendor websites, but audience size and contact details still require confirmation.</p></div><strong>Goal: 3 verified contacts</strong></div>
            <CreatorDiscovery initialCreators={visibleCreators} canManageBilling={entitlement.canManageBilling} paid={paid} topics={creatorTopics} websiteId={context.website!.id} />
          </section>

          <section className="workspace-card distribution-section" id="directories">
            <div className="distribution-section-heading"><div><span className="eyebrow">4 · Directories & reviews</span><h2>Build trust where customers compare options</h2><p>Create missing profiles. If a profile already exists, save its URL in Reviews so Rebound SEO can track public activity separately from direct connections.</p></div><strong>Goal: 1 profile or 3 reviews</strong></div>
            <div className="directory-grid">{baseDirectories.map((directory) => <article key={directory.key}><strong>{directory.name}</strong><p>{directory.detail}</p><a className="secondary-button" href={directory.href} rel="noreferrer" target="_blank">Open {directory.name} ↗</a></article>)}</div>
            <RecommendationPanel canManageBilling={entitlement.canManageBilling} paid={paid} title="Get more directory recommendations">
              {directorySuggestions.length ? directorySuggestions.map((directory) => <article key={directory.key}><strong>{directory.name}</strong><p>{directory.reason}</p><a className="text-button" href={directory.href} rel="noreferrer" target="_blank">Review directory ↗</a></article>) : <p>No additional directory passed the industry-fit rule yet.</p>}
            </RecommendationPanel>
            <Link className="text-button" href="/reviews">Save profile URLs and monitor reviews</Link>
          </section>
        </div>
      )}
    </WorkspaceShell>
  );
}

function RecommendationPanel({ children, paid, title, canManageBilling }: { children: React.ReactNode; paid: boolean; title: string; canManageBilling: boolean }) {
  if (!paid) return <UpgradePreview canManageBilling={canManageBilling} title={title} detail="Upgrade to unlock recommendations selected for your industry and customer journey." />;
  return <details className="recommendation-panel"><summary>{title}</summary><div className="recommendation-grid">{children}</div></details>;
}

function UpgradePreview({ detail, title, canManageBilling }: { detail: string; title: string; canManageBilling: boolean }) {
  return <aside className="upgrade-preview"><div><span>Personalized recommendations</span><strong>{title}</strong><p>{detail}</p></div>{canManageBilling ? <Link className="primary-button" href="/account/billing">View upgrade options</Link> : <p>Ask the website owner to review the subscription.</p>}</aside>;
}
