import { KeywordStrategyReview } from "@/components/keyword-strategy-review";
import { FeatureJourneyCallout } from "@/components/feature-journey-callout";
import { WorkspaceEmpty } from "@/components/workspace-empty";
import { WorkspaceShell } from "@/components/workspace-shell";
import { keywordHasGeographicConflict, rankKeywordOpportunities } from "@/lib/seo/keyword-opportunity";
import { getWorkspaceContext, list, providerResultFromMetrics, record } from "@/lib/workspace-context";

const providerIntent = (value: unknown): "transactional" | "commercial" | "navigational" | "informational" => {
  const intent = String(value || "informational");
  return intent === "transactional" || intent === "commercial" || intent === "navigational" ? intent : "informational";
};

const customerIntent = (value: unknown): "conversion" | "consideration" | "awareness" => {
  const intent = String(value || "awareness");
  return intent === "conversion" || intent === "consideration" ? intent : "awareness";
};

export default async function KeywordsPage() {
  const context = await getWorkspaceContext();
  const provider = providerResultFromMetrics(context.metrics);
  const pages = list(provider.pages).map(record).filter((page) => String(page.role || "other") !== "other" && !/\/(?:blog|news|articles?|category|tag|uncategorized)(?:\/|$)/i.test(String(page.url || "")));
  const vocabulary = list(provider.siteVocabulary).map(record);
  const keywords = list(provider.keywords).map(record);
  const keywordQuest = context.quests.find((quest) => quest.audit_id === context.audit?.id && quest.task_type === "keyword_review");
  const locationEvidence = pages.map((page) => String(page.text || "")).join(" ");
  const keywordBusinessContext = {
    businessName: context.website?.business_name ?? "",
    productsServices: context.website?.products_services ?? "",
    problemSolved: context.website?.problem_solved ?? "",
    idealCustomer: context.website?.ideal_customer ?? "",
    audienceChallengesGoals: context.website?.audience_challenges_goals ?? "",
    differentiation: context.website?.differentiation ?? "",
    market: context.website?.market ?? "",
    locationEvidence,
  };
  const { data: savedDecisions } = context.audit ? await context.supabase.from("keyword_decisions").select("keyword,decision").eq("audit_id", context.audit.id) : { data: [] };
  const initialDecisions = Object.fromEntries((savedDecisions ?? []).map((decision) => [decision.keyword, decision.decision])) as Record<string, "approved" | "declined">;
  const keywordCandidates = keywords.flatMap((keyword) => typeof keyword.keyword === "string" ? [{
    keyword: keyword.keyword,
    searchVolume: Number(keyword.searchVolume ?? 0),
    difficulty: Number(keyword.difficulty ?? 0),
    competitorRankers: Number(keyword.competitorRankers ?? 0),
    directCompetitorRankers: Number(keyword.directCompetitorRankers ?? 0),
    opportunity: String(keyword.opportunity ?? "site_idea"),
    rank: Number(keyword.rank ?? 0),
    cpc: Number(keyword.cpc ?? 0),
    intent: String(keyword.intent ?? keyword.providerIntent ?? "informational"),
    essential: Boolean(keyword.essential),
    priorityScore: Number(keyword.priorityScore ?? 0),
    priorityReason: String(keyword.priorityReason ?? keyword.reason ?? ""),
    providerIntent: providerIntent(keyword.providerIntent ?? keyword.intent),
    searchIntent: customerIntent(keyword.searchIntent),
    themeId: String(keyword.themeId ?? ""),
    themeLabel: String(keyword.themeLabel ?? ""),
    themeRole: String(keyword.themeRole ?? ""),
  }] : []).filter((keyword) => !keywordHasGeographicConflict(keyword, keywordBusinessContext));
  const hasPersistedSemanticStrategy = keywordCandidates.length > 0
    && keywordCandidates.every((keyword) => keyword.priorityScore > 0 && keyword.priorityReason && keyword.themeId && keyword.themeLabel);
  const usableKeywords = hasPersistedSemanticStrategy
    ? keywordCandidates.map((keyword) => ({
      ...keyword,
      competitorRankers: Number(keyword.competitorRankers ?? 0),
      essential: Boolean(keyword.essential),
    }))
    : rankKeywordOpportunities(keywordCandidates, keywordBusinessContext, 50).map((keyword) => ({
      ...keyword,
      competitorRankers: Number(keyword.competitorRankers ?? 0),
      essential: keyword.opportunity === "competitor_gap" && keyword.competitorRankers >= 2 && keyword.providerIntent !== "informational",
    }));
  return <WorkspaceShell active="/keywords" eyebrow={context.website?.normalized_domain ?? "Destiny workspace"} title="Keyword strategy" description="Approve the customer searches that should guide the three-month plan. Commercial and transactional opportunities with credible demand appear first, while useful learning topics remain visible for supporting authority.">
    <FeatureJourneyCallout actionHref="#keyword-strategy-review" actionLabel="Review keyword decisions" milestone="Get ready to be found" description="Approve the searches that should drive the next content task." doneLooksLike="At least five recommended searches are approved for the first content plan." evidence="Saved keyword decisions; rankings appear only after connected data confirms them." />
    {!vocabulary.length ? <WorkspaceEmpty title="Keyword strategy is not ready" description="Run a live audit so Destiny can inspect up to five important pages and build the initial recommendations." /> : <>
      {context.audit && <KeywordStrategyReview auditId={context.audit.id} initialDecisions={initialDecisions} keywords={usableKeywords} moreKeywordsHref={`/keyword-research?site=${context.website?.id ?? ""}&from=strategy`} nextHref={`/content?site=${context.website?.id ?? ""}&strategy=complete`} questId={keywordQuest?.id} questStatus={keywordQuest?.status} />}
      <section className="workspace-card"><div className="workspace-card-heading"><div><strong>Verified pages inspected</strong><small>Only real strategic pages from the live site; blog posts and guessed URLs are excluded</small></div><span>{pages.length} page{pages.length === 1 ? "" : "s"}</span></div><div className="evidence-page-list">{pages.map((page, index) => <a href={String(page.url)} key={`${String(page.url)}-${index}`} rel="noreferrer" target="_blank"><span>{String(page.role).replaceAll("_", " ")}</span><strong>{String(page.title || page.url)}</strong><small>{String(page.url)}</small></a>)}</div></section>
      <details className="workspace-card keyword-methodology"><summary><span><strong>How Destiny prioritized these keywords</strong><small>Open the research and scoring method</small></span><b>View method</b></summary><div><section><div className="workspace-card-heading"><div><strong>Business understanding</strong><small>Verified site pages plus your onboarding answers</small></div><span>{vocabulary.length} evidence terms</span></div><div className="vocabulary-cloud">{vocabulary.slice(0, 40).map((term) => <span key={String(term.normalized)} title={String(term.evidence)}>{String(term.term)} <b>{Number(term.weight).toFixed(1)}</b></span>)}</div></section><section><div className="workspace-card-heading"><div><strong>Revenue-opportunity scoring</strong><small>Search intent + monthly demand + attainable difficulty + CPC value + current rank or competitor gap</small></div><span>{usableKeywords.length} recommendations</span></div><p className="keyword-method-note">Transactional and commercial searches lead when demand is meaningful. Informational topics remain in the pool when they support the business, but raw volume alone cannot outrank a stronger path to revenue.</p></section></div></details>
    </>}
  </WorkspaceShell>;
}
