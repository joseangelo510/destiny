import { KeywordStrategyReview } from "@/components/keyword-strategy-review";
import { FeatureJourneyCallout } from "@/components/feature-journey-callout";
import { WorkspaceEmpty } from "@/components/workspace-empty";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getWorkspaceContext, list, providerResultFromMetrics, record } from "@/lib/workspace-context";

export default async function KeywordsPage() {
  const context = await getWorkspaceContext();
  const provider = providerResultFromMetrics(context.metrics);
  const pages = list(provider.pages).map(record);
  const vocabulary = list(provider.siteVocabulary).map(record);
  const keywords = list(provider.keywords).map(record);
  const keywordQuest = context.quests.find((quest) => quest.audit_id === context.audit?.id && quest.task_type === "keyword_review");
  const { data: savedDecisions } = context.audit ? await context.supabase.from("keyword_decisions").select("keyword,decision").eq("audit_id", context.audit.id) : { data: [] };
  const initialDecisions = Object.fromEntries((savedDecisions ?? []).map((decision) => [decision.keyword, decision.decision])) as Record<string, "approved" | "declined">;
  const usableKeywords = keywords.filter((keyword) => keyword.verdict !== "reject").slice(0, 8).map((keyword) => ({
    keyword: String(keyword.keyword), searchVolume: Number(keyword.searchVolume ?? 0), difficulty: Number(keyword.difficulty ?? 0), competitorRankers: Number(keyword.competitorRankers ?? 0), opportunity: String(keyword.opportunity ?? "site_idea"), reason: String(keyword.reason ?? "Supported by the saved audit evidence."), essential: Boolean(keyword.essential),
  }));
  return <WorkspaceShell active="/keywords" eyebrow={context.website?.normalized_domain ?? "Destiny workspace"} title="Keyword strategy" description="Choose the customer searches Destiny should use for your content plan. Each recommendation is checked against your website, onboarding answers, and competitor rankings.">
    <FeatureJourneyCallout milestone="First content published" description="Approving a focused keyword sets the route for the next content task; rankings unlock only after connected data confirms them." />
    {!vocabulary.length ? <WorkspaceEmpty title="Keyword strategy is not ready" description="Run a live audit so Destiny can inspect up to five important pages and build the initial recommendations." /> : <>
      {context.audit && <KeywordStrategyReview auditId={context.audit.id} initialDecisions={initialDecisions} keywords={usableKeywords} questId={keywordQuest?.id} questStatus={keywordQuest?.status} />}
      <section className="workspace-card"><div className="workspace-card-heading"><div><strong>Pages inspected</strong><small>DataForSEO Content Parsing Live</small></div><span>{pages.length} of 5</span></div><div className="evidence-page-list">{pages.map((page, index) => <a href={String(page.url)} key={`${String(page.url)}-${index}`} rel="noreferrer" target="_blank"><span>{String(page.role).replaceAll("_", " ")}</span><strong>{String(page.title || page.url)}</strong><small>{String(page.url)}</small></a>)}</div></section>
      <details className="workspace-card keyword-methodology"><summary><span><strong>How Destiny chose these keywords</strong><small>Open the research evidence</small></span><b>View method</b></summary><div><section><div className="workspace-card-heading"><div><strong>Extracted business vocabulary</strong><small>From five pages and your onboarding answers</small></div><span>{vocabulary.length} terms</span></div><div className="vocabulary-cloud">{vocabulary.slice(0, 40).map((term) => <span key={String(term.normalized)} title={String(term.evidence)}>{String(term.term)} <b>{Number(term.weight).toFixed(1)}</b></span>)}</div></section><section><div className="workspace-card-heading"><div><strong>LOGOS recommendation checks</strong><small>Priority gap = business match plus at least two competitor rankers</small></div><span>{keywords.filter((keyword) => keyword.verdict !== "reject").length} usable</span></div><div className="keyword-decision-list">{keywords.map((keyword, index) => <article className={`keyword-decision ${String(keyword.verdict || "review")}`} key={`${String(keyword.keyword)}-${index}`}><div><strong>{String(keyword.keyword)}</strong><small>{Number(keyword.searchVolume ?? 0).toLocaleString()} searches · {Number(keyword.competitorRankers ?? 0)} competitor rankers</small></div><p>{String(keyword.reason || "Awaiting a LOGOS decision trace")}</p><span>{keyword.essential ? "Priority gap" : String(keyword.verdict || "review")}</span></article>)}</div></section></div></details>
    </>}
  </WorkspaceShell>;
}
