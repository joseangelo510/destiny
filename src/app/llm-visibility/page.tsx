import { WorkspaceEmpty } from "@/components/workspace-empty";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getWorkspaceContext, list, providerResultFromMetrics, record } from "@/lib/workspace-context";

export default async function LlmVisibilityPage() {
  const context = await getWorkspaceContext();
  const provider = providerResultFromMetrics(context.metrics);
  const llm = record(provider.llmVisibility);
  const platforms = list(llm.platforms).map(record);
  const domains = list(llm.topCitedDomains).map(record);
  return <WorkspaceShell active="/llm-visibility" eyebrow={context.website?.normalized_domain ?? "Destiny workspace"} title="LLM visibility" description="Live DataForSEO evidence for company mentions and the domains AI answers cite as sources.">
    {llm.status !== "available" ? <WorkspaceEmpty title="LLM visibility is not available yet" description={String(llm.reason || "Run a live DataForSEO audit to check ChatGPT and Google AI Overview mention data.")} /> : <>
      <section className="analytics-grid"><article className="result-stat analytics-stat"><strong>{Number(llm.totalMentions ?? 0).toLocaleString()}</strong><span>Company mentions</span><small>Across available AI platforms</small></article><article className="result-stat analytics-stat"><strong>{Number(llm.aiSearchVolume ?? 0).toLocaleString()}</strong><span>AI search volume</span><small>DataForSEO estimate</small></article>{platforms.map((platform) => <article className="result-stat analytics-stat" key={String(platform.platform)}><strong>{Number(platform.mentions ?? 0).toLocaleString()}</strong><span>{String(platform.platform)} mentions</span><small>{Number(platform.aiSearchVolume ?? 0).toLocaleString()} AI search volume</small></article>)}</section>
      <section className="workspace-card"><div className="workspace-card-heading"><div><strong>Top cited domains</strong><small>Sources appearing in AI answers related to your company</small></div><span>{domains.length} domains</span></div><div className="cited-domain-list">{domains.map((domain, index) => <a href={String(domain.website)} key={`${String(domain.domain)}-${index}`} rel="noreferrer" target="_blank"><span>{index + 1}</span><div><strong>{String(domain.company)}</strong><small>{String(domain.domain)}</small></div><b>{Number(domain.mentions ?? 0).toLocaleString()} citations</b></a>)}</div></section>
    </>}
  </WorkspaceShell>;
}
