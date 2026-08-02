import { LlmSourceDashboard } from "@/components/llm-source-dashboard";
import { WorkspaceEmpty } from "@/components/workspace-empty";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getWorkspaceContext, list, providerResultFromMetrics, record } from "@/lib/workspace-context";

export default async function LlmVisibilityPage() {
  const context = await getWorkspaceContext();
  const provider = providerResultFromMetrics(context.metrics);
  const llm = record(provider.llmVisibility);
  const platforms = list(llm.platforms).map(record);
  const domains = list(llm.topCitedDomains).map(record);

  if (!context.website) {
    return <WorkspaceShell active="/llm-visibility" eyebrow="Destiny workspace" title="LLM visibility" description="Build source readiness, then verify company mentions and citations with provider evidence.">
      <WorkspaceEmpty title="Complete onboarding to build your AI visibility map" description="Destiny needs a business website before it can save source-specific actions and monitor available visibility evidence." />
    </WorkspaceShell>;
  }

  const { data: sourceTasks } = await context.supabase
    .from("llm_visibility_tasks")
    .select("id,source_key,task_key,status,completed_at,proof_url,proof_attached_at,updated_at")
    .eq("website_id", context.website.id)
    .order("updated_at", { ascending: true });

  return <WorkspaceShell active="/llm-visibility" eyebrow={context.website.normalized_domain} title="LLM visibility" description="Build source readiness through small actions, then verify company mentions and citations with separate provider evidence.">
    <LlmSourceDashboard
      initialRecords={(sourceTasks ?? []).map((task) => ({
        id: task.id,
        source_key: task.source_key,
        task_key: task.task_key,
        status: task.status,
        completed_at: task.completed_at,
        proof_url: task.proof_url,
        proof_attached_at: task.proof_attached_at,
        updated_at: task.updated_at,
      }))}
      llmVisibility={{
        status: llm.status,
        totalMentions: llm.totalMentions,
        platforms: platforms.map((platform) => ({ platform: platform.platform, mentions: platform.mentions })),
      }}
      websiteId={context.website.id}
    />

    <section id="verified-evidence">
      <div className="workspace-card-heading"><div><strong>Your verified provider evidence</strong><small>Observed mention and citation data stays separate from readiness</small></div>{llm.status === "available" ? <span>DataForSEO evidence</span> : null}</div>
      {llm.status !== "available" ? <WorkspaceEmpty title="LLM visibility evidence is not available yet" description={String(llm.reason || "Run a live DataForSEO audit to check available ChatGPT and Google AI mention data.")} /> : <>
        <div className="analytics-grid"><article className="result-stat analytics-stat"><strong>{Number(llm.totalMentions ?? 0).toLocaleString()}</strong><span>Company mentions</span><small>Across available tracked AI platforms</small></article><article className="result-stat analytics-stat"><strong>{Number(llm.aiSearchVolume ?? 0).toLocaleString()}</strong><span>AI search volume</span><small>DataForSEO estimate</small></article>{platforms.map((platform) => <article className="result-stat analytics-stat" key={String(platform.platform)}><strong>{Number(platform.mentions ?? 0).toLocaleString()}</strong><span>{String(platform.platform)} mentions</span><small>{Number(platform.aiSearchVolume ?? 0).toLocaleString()} estimated AI search volume</small></article>)}</div>
        <section className="workspace-card"><div className="workspace-card-heading"><div><strong>Domains cited in related AI answers</strong><small>Observed sources in the available provider dataset</small></div><span>{domains.length} domains</span></div><div className="cited-domain-list">{domains.map((domain, index) => <a href={String(domain.website)} key={`${String(domain.domain)}-${index}`} rel="noreferrer" target="_blank"><span>{index + 1}</span><div><strong>{String(domain.company)}</strong><small>{String(domain.domain)}</small></div><b>{Number(domain.mentions ?? 0).toLocaleString()} observed citations</b></a>)}</div></section>
      </>}
    </section>
  </WorkspaceShell>;
}
