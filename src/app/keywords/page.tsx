import { QuestCompletion } from "@/components/quest-completion";
import { WorkspaceEmpty } from "@/components/workspace-empty";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getWorkspaceContext, list, providerResultFromMetrics, record } from "@/lib/workspace-context";

export default async function KeywordsPage() {
  const context = await getWorkspaceContext();
  const provider = providerResultFromMetrics(context.metrics);
  const pages = list(provider.pages).map(record);
  const vocabulary = list(provider.siteVocabulary).map(record);
  const keywords = list(provider.keywords).map(record);
  const vocabularyQuest = context.quests.find((quest) => quest.audit_id === context.audit?.id && quest.task_type === "vocabulary_review");
  return <WorkspaceShell active="/keywords" eyebrow={context.website?.normalized_domain ?? "Destiny workspace"} title="Keyword evidence" description="See the exact pages and site vocabulary LOGOS used before accepting, reviewing, or rejecting a keyword.">
    {!vocabulary.length ? <WorkspaceEmpty title="Keyword evidence is not ready" description="Run a live audit so Destiny can inspect up to five important pages and build the vocabulary list." /> : <>
      <section className="workspace-card evidence-approval"><div><strong>1. Review your site vocabulary</strong><p>These phrases came from your homepage, product or service, how-it-works, about, and contact evidence plus onboarding context.</p></div>{vocabularyQuest && <QuestCompletion questId={vocabularyQuest.id} status={vocabularyQuest.status} xp={vocabularyQuest.xp} completeLabel="Approve vocabulary" completedLabel="Reopen vocabulary review" />}</section>
      <section className="workspace-card"><div className="workspace-card-heading"><div><strong>Pages inspected</strong><small>DataForSEO Content Parsing Live</small></div><span>{pages.length} of 5</span></div><div className="evidence-page-list">{pages.map((page, index) => <a href={String(page.url)} key={`${String(page.url)}-${index}`} rel="noreferrer" target="_blank"><span>{String(page.role).replaceAll("_", " ")}</span><strong>{String(page.title || page.url)}</strong><small>{String(page.url)}</small></a>)}</div></section>
      <section className="workspace-card"><div className="workspace-card-heading"><div><strong>Extracted site vocabulary</strong><small>Weighted, normalized, and inspectable</small></div><span>{vocabulary.length} terms</span></div><div className="vocabulary-cloud">{vocabulary.slice(0, 40).map((term) => <span key={String(term.normalized)} title={String(term.evidence)}>{String(term.term)} <b>{Number(term.weight).toFixed(1)}</b></span>)}</div></section>
      <section className="workspace-card"><div className="workspace-card-heading"><div><strong>LOGOS keyword decisions</strong><small>Essential = vocabulary match plus at least two competitor rankers</small></div><span>{keywords.filter((keyword) => keyword.verdict !== "reject").length} usable</span></div><div className="keyword-decision-list">{keywords.map((keyword, index) => <article className={`keyword-decision ${String(keyword.verdict || "review")}`} key={`${String(keyword.keyword)}-${index}`}><div><strong>{String(keyword.keyword)}</strong><small>{Number(keyword.searchVolume ?? 0).toLocaleString()} searches · {Number(keyword.competitorRankers ?? 0)} competitor rankers</small></div><p>{String(keyword.reason || "Awaiting a LOGOS decision trace")}</p><span>{keyword.essential ? "Essential gap" : String(keyword.verdict || "review")}</span></article>)}</div></section>
    </>}
  </WorkspaceShell>;
}
