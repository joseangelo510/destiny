import Link from "next/link";
import { CopyButton } from "@/components/copy-button";
import { WorkspaceEmpty } from "@/components/workspace-empty";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getWorkspaceContext, list, providerResultFromMetrics, record } from "@/lib/workspace-context";

export default async function DistributionPage() {
  const context = await getWorkspaceContext();
  const providerResult = providerResultFromMetrics(context.metrics);
  const opportunities = list(providerResult.distributionOpportunities).map(record);
  const publishers = list(providerResult.publisherOpportunities).map(record);
  const articleUrl = context.website?.url ?? "";
  const articleTitle = `A useful guide from ${context.website?.business_name ?? "our team"}`;
  const linkedInShare = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(articleUrl)}`;
  const xShare = `https://x.com/intent/post?text=${encodeURIComponent(`${articleTitle} ${articleUrl}`)}`;
  const directories = [
    { name: "Product Hunt", href: "https://www.producthunt.com/posts/new", detail: "Launch or update your product listing." },
    { name: "G2", href: "https://www.g2.com/products/new", detail: "Create a product profile and invite verified customers." },
    { name: "Capterra", href: "https://www.capterra.com/vendors/sign-up", detail: "Add your software or service to the buyer directory." },
    { name: "Google Business Profile", href: "https://business.google.com/", detail: "Complete your local profile or build review momentum." },
  ];
  return (
    <WorkspaceShell active="/distribution" eyebrow={context.website?.normalized_domain ?? "Destiny workspace"} title="Distribute this week’s work" description="Use four practical channels: helpful community replies, social sharing, publisher outreach, and trusted directory or review profiles.">
      {!context.audit ? <WorkspaceEmpty title="Run an audit first" description="Destiny needs your search context before it can recommend relevant distribution opportunities." /> : (
        <div className="distribution-sections">
          <section className="workspace-card distribution-section" id="community"><div className="distribution-section-heading"><div><span className="eyebrow">1 · Community forums</span><h2>Reply to three useful Reddit or Quora threads</h2><p>Help first. Add a link only when it genuinely answers the question.</p></div><strong>Goal: 3 replies</strong></div><div className="opportunity-grid compact">{opportunities.slice(0, 6).map((opportunity, index) => {
            const network = String(opportunity.platform);
            return <article className="opportunity-item" key={`${String(opportunity.url)}-${index}`}><span className="status-chip amber">Not answered</span><div className="eyebrow">Verified {network} thread</div><h3>{String(opportunity.title)}</h3><p>{String(opportunity.snippet || `A live ${network} conversation related to ${String(opportunity.topic)}.`)}</p><a className="secondary-button workspace-action" href={String(opportunity.url)} rel="noreferrer" target="_blank">Open live thread ↗</a></article>;
          })}</div>{!opportunities.length && <p className="empty-state">No individual live threads passed the check. Run a fresh audit later; Destiny will not send you to a generic search page.</p>}</section>

          <section className="workspace-card distribution-section" id="social"><div className="distribution-section-heading"><div><span className="eyebrow">2 · Social sharing</span><h2>Share the approved article with your network</h2><p>Connect the article to a firsthand observation instead of posting a generic link.</p></div><strong>Goal: LinkedIn + X</strong></div><div className="social-share-actions"><a className="primary-button" href={linkedInShare} rel="noreferrer" target="_blank">Share on LinkedIn ↗</a><a className="secondary-button" href={xShare} rel="noreferrer" target="_blank">Share on X ↗</a><Link className="text-button" href="/content">Review articles first</Link></div></section>

          <section className="workspace-card distribution-section" id="outreach"><div className="distribution-section-heading"><div><span className="eyebrow">3 · Publisher outreach</span><h2>Contact non-competing sites already ranking for your keyword</h2><p>Destiny removes your listed competitors and social networks, then gives you a short, review-first outreach draft.</p></div><strong>Goal: 3 contacts</strong></div><div className="publisher-list">{publishers.map((publisher, index) => {
            const domain = String(publisher.domain);
            const keyword = String(publisher.keyword || "the topic");
            const draft = `Hi there,\n\nI found your ${keyword} resource while researching the topic. We have a practical article and firsthand perspective that may add a useful example for your readers. Would you be open to reviewing it as a possible reference or contribution?\n\nI’m happy to send the short summary first.\n\nBest,\n${context.profile?.first_name ?? ""}`;
            return <article key={`${domain}-${index}`}><div><span>{index + 1}</span><div><strong>{domain}</strong><p>{String(publisher.title)}</p><small>Ranks for “{keyword}” · not one of your listed competitors</small></div></div><div><a className="text-button" href={String(publisher.url)} rel="noreferrer" target="_blank">Open publisher ↗</a><CopyButton text={draft} /></div></article>;
          })}</div>{!publishers.length && <p className="empty-state">No non-competing publisher passed the live result check for this audit. A fresh audit will search again.</p>}</section>

          <section className="workspace-card distribution-section" id="directories"><div className="distribution-section-heading"><div><span className="eyebrow">4 · Directories & reviews</span><h2>Build trust where customers compare options</h2><p>Create missing profiles. If a profile already exists, focus this week’s task on collecting three honest customer or partner reviews.</p></div><strong>Goal: 1 profile or 3 reviews</strong></div><div className="directory-grid">{directories.map((directory) => <article key={directory.name}><strong>{directory.name}</strong><p>{directory.detail}</p><a className="secondary-button" href={directory.href} rel="noreferrer" target="_blank">Open {directory.name} ↗</a></article>)}</div><Link className="text-button" href="/reviews">Open review request tools</Link></section>
        </div>
      )}
    </WorkspaceShell>
  );
}
