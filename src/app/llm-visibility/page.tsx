import { WorkspaceEmpty } from "@/components/workspace-empty";
import { WorkspaceShell } from "@/components/workspace-shell";
import { AI_CITATION_BENCHMARK, buildAiVisibilityProgress } from "@/lib/llm/progress";
import { getWorkspaceContext, list, providerResultFromMetrics, record } from "@/lib/workspace-context";

const ACTIONABLE_BENCHMARK_DOMAINS = new Set([
  "reddit.com",
  "linkedin.com",
  "medium.com",
  "youtube.com",
  "google.com",
  "forbes.com",
  "quora.com",
  "g2.com",
]);

export default async function LlmVisibilityPage() {
  const context = await getWorkspaceContext();
  const provider = providerResultFromMetrics(context.metrics);
  const llm = record(provider.llmVisibility);
  const platforms = list(llm.platforms).map(record);
  const domains = list(llm.topCitedDomains).map(record);
  const progress = buildAiVisibilityProgress({
    quests: context.quests.map((quest) => ({
      task_type: String(quest.task_type || ""),
      status: String(quest.status || "todo"),
      verification_status: typeof quest.verification_status === "string" ? quest.verification_status : null,
    })),
    llmVisibility: {
      status: llm.status,
      totalMentions: llm.totalMentions,
      platforms: platforms.map((platform) => ({ platform: platform.platform, mentions: platform.mentions })),
      topCitedDomains: domains.map((domain) => ({ domain: domain.domain, mentions: domain.mentions })),
    },
  });
  const readinessPercent = Math.round((progress.readiness.completed / progress.readiness.total) * 100);
  const actionableDomains = AI_CITATION_BENCHMARK.domains.filter((domain) => ACTIONABLE_BENCHMARK_DOMAINS.has(domain.domain));

  return <WorkspaceShell active="/llm-visibility" eyebrow={context.website?.normalized_domain ?? "Destiny workspace"} title="LLM visibility" description="Build citation readiness, then verify company mentions and cited sources with live provider evidence.">
    <section className="ai-progress-overview" aria-label="Path to AI visibility">
      <article className="ai-readiness-card">
        <span>Citation readiness</span>
        <strong>{progress.readiness.label}</strong>
        <p>These are actions you can complete. They do not count as an AI mention or citation until Destiny detects separate evidence.</p>
        <div className="ai-readiness-track" role="progressbar" aria-label="Citation readiness actions" aria-valuemin={0} aria-valuemax={progress.readiness.total} aria-valuenow={progress.readiness.completed}><span style={{ width: `${readinessPercent}%` }} /></div>
        <p>{readinessPercent}% of readiness work complete</p>
      </article>
      <article className={`ai-verified-card ${progress.verifiedVisibility.detected ? "verified" : ""}`}>
        <span>Verified visibility</span>
        <strong>{progress.verifiedVisibility.detected ? `${progress.verifiedVisibility.totalMentions.toLocaleString()} mentions detected` : "No verified mentions yet"}</strong>
        <p>{progress.verifiedVisibility.evidenceAvailable ? "Based on available DataForSEO tracked-prompt evidence." : "Run supported AI visibility research to begin monitoring. Readiness progress does not change this result."}</p>
      </article>
    </section>

    <section className="workspace-card">
      <div className="workspace-card-heading"><div><strong>Your path to AI visibility</strong><small>Effort and verified outcomes use different labels</small></div><span>{progress.readiness.completed}/{progress.readiness.total} readiness</span></div>
      <div className="ai-progress-path">
        {progress.stages.map((stage, index) => <article className={`ai-progress-stage ${stage.state}`} key={stage.id}>
          <span>{stage.state === "verified" || stage.state === "complete" ? "✓" : index + 1}</span>
          <div><h2>{stage.title}</h2><p>{stage.description}</p><small className="ai-stage-evidence">{stage.kind === "effort" ? "Readiness · " : "Verified outcome · "}{stage.evidenceLabel}</small></div>
          <a href={stage.actionPath}>{stage.state === "complete" || stage.state === "verified" ? "View evidence" : "Continue"} →</a>
        </article>)}
      </div>
    </section>

    <section className="workspace-card">
      <div className="workspace-card-heading"><div><strong>High-citation ecosystems to build toward</strong><small>Prioritized channels from an industry benchmark</small></div><span>Benchmark, not live proof</span></div>
      <p className="citation-benchmark-note"><strong>{AI_CITATION_BENCHMARK.asOf} benchmark:</strong> Semrush studied {AI_CITATION_BENCHMARK.promptCount.toLocaleString()} prompts across ChatGPT search, Google AI Mode, and Perplexity. Citation patterns change, and relevance depends on the business. <a href={AI_CITATION_BENCHMARK.sourceUrl} rel="noreferrer" target="_blank">Read the study</a>.</p>
      <div className="citation-channel-grid">
        {actionableDomains.map((domain) => <article className="citation-channel" key={domain.domain}><div><span>{domain.rank}</span><strong>{domain.label}</strong></div><small>{domain.action}</small></article>)}
      </div>
      <details className="citation-benchmark-details"><summary>See all 20 domains in the October 2025 reference</summary><p>{AI_CITATION_BENCHMARK.domains.map((domain) => `${domain.rank}. ${domain.domain}`).join(" · ")}</p></details>
    </section>

    <section id="verified-evidence">
      <div className="workspace-card-heading"><div><strong>Your verified provider evidence</strong><small>Observed mention and citation data stays separate from readiness</small></div>{llm.status === "available" ? <span>DataForSEO evidence</span> : null}</div>
      {llm.status !== "available" ? <WorkspaceEmpty title="LLM visibility evidence is not available yet" description={String(llm.reason || "Run a live DataForSEO audit to check available ChatGPT and Google AI mention data.")} /> : <>
        <div className="analytics-grid"><article className="result-stat analytics-stat"><strong>{Number(llm.totalMentions ?? 0).toLocaleString()}</strong><span>Company mentions</span><small>Across available tracked AI platforms</small></article><article className="result-stat analytics-stat"><strong>{Number(llm.aiSearchVolume ?? 0).toLocaleString()}</strong><span>AI search volume</span><small>DataForSEO estimate</small></article>{platforms.map((platform) => <article className="result-stat analytics-stat" key={String(platform.platform)}><strong>{Number(platform.mentions ?? 0).toLocaleString()}</strong><span>{String(platform.platform)} mentions</span><small>{Number(platform.aiSearchVolume ?? 0).toLocaleString()} estimated AI search volume</small></article>)}</div>
        <section className="workspace-card"><div className="workspace-card-heading"><div><strong>Domains cited in related AI answers</strong><small>Observed sources in the available provider dataset</small></div><span>{domains.length} domains</span></div><div className="cited-domain-list">{domains.map((domain, index) => <a href={String(domain.website)} key={`${String(domain.domain)}-${index}`} rel="noreferrer" target="_blank"><span>{index + 1}</span><div><strong>{String(domain.company)}</strong><small>{String(domain.domain)}</small></div><b>{Number(domain.mentions ?? 0).toLocaleString()} observed citations</b></a>)}</div></section>
      </>}
    </section>
  </WorkspaceShell>;
}
