import { WorkspaceEmpty } from "@/components/workspace-empty";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getWorkspaceContext, list, providerResultFromMetrics, record } from "@/lib/workspace-context";

export default async function DistributionPage() {
  const context = await getWorkspaceContext();
  const opportunities = list(providerResultFromMetrics(context.metrics).distributionOpportunities).map(record);
  return (
    <WorkspaceShell active="/distribution" eyebrow={context.website?.normalized_domain ?? "Destiny workspace"} title="Distribution opportunities" description="Find real conversations where your expertise can help. Destiny never claims something was posted until you confirm it.">
      {!context.audit ? <WorkspaceEmpty title="Run an audit first" description="Destiny needs your search context before it can recommend relevant distribution opportunities." /> : (
        <section className="opportunity-grid">
          {opportunities.map((opportunity, index) => {
            const network = String(opportunity.platform);
            return <article className="workspace-card opportunity-item" key={`${String(opportunity.url)}-${index}`}><span className="status-chip amber">Not answered</span><div className="eyebrow">Verified {network} thread</div><h2>{String(opportunity.title)}</h2><p>{String(opportunity.snippet || `A live ${network} conversation related to ${String(opportunity.topic)}.`)}</p><small>Checked {new Date(String(opportunity.checkedAt)).toLocaleDateString()}</small><a className="secondary-button workspace-action" href={String(opportunity.url)} rel="noreferrer" target="_blank">Open live thread ↗</a></article>;
          })}
          {!opportunities.length && <WorkspaceEmpty title="No individual live threads passed the check" description="Destiny does not send you to generic search pages. Run a fresh audit later to look for current Reddit and Quora threads tied to an approved keyword." />}
        </section>
      )}
    </WorkspaceShell>
  );
}
