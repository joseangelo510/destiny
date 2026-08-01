import { WorkspaceEmpty } from "@/components/workspace-empty";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getWorkspaceContext, list, providerResultFromMetrics, record } from "@/lib/workspace-context";

export default async function DistributionPage() {
  const context = await getWorkspaceContext();
  const keywords = list(providerResultFromMetrics(context.metrics).keywords).map(record).slice(0, 4);
  return (
    <WorkspaceShell active="/distribution" eyebrow={context.website?.normalized_domain ?? "Destiny workspace"} title="Distribution opportunities" description="Find real conversations where your expertise can help. Destiny never claims something was posted until you confirm it.">
      {!context.audit ? <WorkspaceEmpty title="Run an audit first" description="Destiny needs your search context before it can recommend relevant distribution opportunities." /> : (
        <section className="opportunity-grid">
          {keywords.map((keyword, index) => {
            const query = encodeURIComponent(String(keyword.keyword ?? context.website?.business_name ?? ""));
            const network = index % 2 === 0 ? "Reddit" : "Quora";
            const href = network === "Reddit" ? `https://www.reddit.com/search/?q=${query}` : `https://www.quora.com/search?q=${query}`;
            return <article className="workspace-card opportunity-item" key={`${network}-${index}`}><span className="status-chip amber">Not posted</span><div className="eyebrow">{network} opportunity</div><h2>{String(keyword.keyword ?? "Share your expertise")}</h2><p>Open current discussions and choose a question where you can provide a genuinely useful answer.</p><a className="secondary-button workspace-action" href={href} rel="noreferrer" target="_blank">Find a live {network} discussion →</a></article>;
          })}
          {!keywords.length && <WorkspaceEmpty title="No distribution topics yet" description="Your saved keyword strategy will generate specific Reddit and Quora searches here." />}
        </section>
      )}
    </WorkspaceShell>
  );
}
