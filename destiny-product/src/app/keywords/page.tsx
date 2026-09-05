import { loadNewKeywordRecommendations } from "@/lib/seo/load-new-keyword-recommendations";
import { KeywordStrategyReview } from "@/components/keyword-strategy-review";
import { StrategyPipelineStrip } from "@/components/strategy-pipeline-strip";
import type { SupabaseClient } from "@supabase/supabase-js";
import { WorkspaceEmpty } from "@/components/workspace-empty";
import { WorkspaceShell } from "@/components/workspace-shell";
import { runDestinyServerLogic } from "@/lib/logicaffeine-server";
import { INITIAL_KEYWORD_APPROVAL_TARGET } from "@/lib/product/plan-horizon";
import { keywordHasGeographicConflict, rankKeywordOpportunities } from "@/lib/seo/keyword-opportunity";
import { keywordStrategyAction } from "@/lib/seo/keyword-strategy-actions";
import { keywordWatchlistCount } from "@/lib/seo/keyword-strategy-summary";
import { normalizeTrackedKeyword } from "@/lib/seo/rank-tracker";
import { getWorkspaceContext, list, providerResultFromMetrics, record } from "@/lib/workspace-context";
import "./claude-keyword-strategy.css";

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
  const newResearch = await loadNewKeywordRecommendations(context);
  const keywords = [...list(provider.keywords).map(record), ...newResearch.keywords.map(record)];
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
  const keywordCandidates = keywords.flatMap((keyword) => typeof keyword.keyword === "string" ? [{
    keyword: keyword.keyword,
    coverageDescription: typeof keyword.coverageDescription === "string" ? keyword.coverageDescription : undefined,
    coverageCheckedAt: typeof keyword.coverageCheckedAt === "string" ? keyword.coverageCheckedAt : undefined,
    pageType: typeof keyword.pageType === "string" ? keyword.pageType : undefined,
    searchVolume: Number(keyword.searchVolume ?? 0),
    difficulty: Number(keyword.difficulty ?? 0),
    competitorRankers: Number(keyword.competitorRankers ?? 0),
    directCompetitorRankers: Number(keyword.directCompetitorRankers ?? 0),
    opportunity: String(keyword.opportunity ?? "site_idea"),
    rank: Number(keyword.rank ?? 0),
    rankingUrl: String(keyword.url ?? ""),
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
  const [{ data: savedPreferences }, { data: trackedKeywords }, { data: rankObservations }] = context.website
    ? await Promise.all([
      context.supabase.from("keyword_preferences").select("keyword,normalized_keyword,decision,reason,search_volume,difficulty,priority_score,provider_intent,search_intent,theme_id,theme_label").eq("website_id", context.website.id),
      context.supabase.from("tracked_keywords").select("id,normalized_keyword,last_checked_at,status,source").eq("website_id", context.website.id).neq("status", "paused"),
      context.supabase.from("rank_observations").select("tracked_keyword_id,observed_at,found,position,result_url").eq("website_id", context.website.id).order("observed_at", { ascending: false }).limit(2000),
    ])
    : [{ data: [] }, { data: [] }, { data: [] }];
  const preferenceByNormalized = new Map((savedPreferences ?? []).map((preference) => [preference.normalized_keyword, preference]));
  const currentNormalizedKeywords = new Set(usableKeywords.map((keyword) => normalizeTrackedKeyword(keyword.keyword)));
  const archivedKeywords = (savedPreferences ?? []).flatMap((preference) => currentNormalizedKeywords.has(preference.normalized_keyword) ? [] : [{
    keyword: preference.keyword,
    searchVolume: Number(preference.search_volume ?? 0),
    difficulty: Number(preference.difficulty ?? 0),
    competitorRankers: 0,
    rank: 0,
    rankingUrl: "",
    cpc: 0,
    opportunity: "saved_strategy",
    providerIntent: providerIntent(preference.provider_intent),
    searchIntent: customerIntent(preference.search_intent),
    priorityScore: Number(preference.priority_score ?? 0),
    priorityReason: "Saved from an earlier keyword strategy for this website.",
    themeId: String(preference.theme_id ?? "saved-strategy"),
    themeLabel: String(preference.theme_label ?? "Saved strategy"),
    themeRole: "saved",
    essential: false,
  }]);
  const latestObservationByTrackedId = new Map<string, NonNullable<typeof rankObservations>[number]>();
  for (const observation of rankObservations ?? []) {
    if (!latestObservationByTrackedId.has(observation.tracked_keyword_id)) latestObservationByTrackedId.set(observation.tracked_keyword_id, observation);
  }
  const trackedByNormalized = new Map((trackedKeywords ?? []).map((tracked) => [tracked.normalized_keyword, tracked]));
  const providerUrlsByNormalized = keywords.reduce<Map<string, string[]>>((grouped, keyword) => {
    const normalized = normalizeTrackedKeyword(String(keyword.keyword ?? ""));
    const url = String(keyword.url ?? "").trim();
    if (!normalized || !url) return grouped;
    grouped.set(normalized, [...new Set([...(grouped.get(normalized) ?? []), url])]);
    return grouped;
  }, new Map());
  const searchConsoleIntegration = context.integrations.find((item) => item.provider === "google_search_console" && item.status === "connected" && item.last_synced_at);
  const searchConsoleMetadata = searchConsoleIntegration ? record(searchConsoleIntegration.metadata) : {};
  const gscByNormalized = new Map(list(searchConsoleMetadata.topQueries).map(record).flatMap((query) => {
    const normalized = normalizeTrackedKeyword(String(query.query ?? ""));
    return normalized ? [[normalized, query] as const] : [];
  }));
  const workspaceKeywords = await Promise.all([...usableKeywords, ...archivedKeywords].map(async (keyword) => {
    const normalized = normalizeTrackedKeyword(keyword.keyword);
    const tracked = trackedByNormalized.get(normalized);
    const observation = tracked ? latestObservationByTrackedId.get(tracked.id) : null;
    const observedRank = observation?.found && observation.position ? Number(observation.position) : 0;
    const rank = observedRank || Number(keyword.rank ?? 0);
    const rankingUrls = [...new Set([
      ...(providerUrlsByNormalized.get(normalized) ?? []),
      String(keyword.rankingUrl ?? ""),
      observation?.found ? String(observation.result_url ?? "") : "",
    ].filter(Boolean))];
    const rankPolicy = await runDestinyServerLogic({
      auditComplete: 1,
      criticalIssues: 0,
      warnings: 0,
      rankingKeywords: 0,
      newKeywords: 0,
      lostKeywords: 0,
      contentGaps: 0,
      reviewCount: 0,
      rankStatusCode: rank > 0 ? 1 : 0,
      rankFoundCode: rank > 0 ? 1 : 0,
      rankCurrentPosition: rank,
    });
    const action = keywordStrategyAction({ rank, rankBucket: rankPolicy.rankBucket, rankingUrls });
    const gsc = gscByNormalized.get(normalized);
    return {
      ...keyword,
      rank,
      rankingUrls,
      rankingUrl: rankingUrls[0] ?? "",
      verdict: action.verdict,
      verdictDescription: action.description,
      gscPosition: Number(gsc?.position ?? 0),
      gscImpressions: Number(gsc?.impressions ?? 0),
      gscClicks: Number(gsc?.clicks ?? 0),
      rankCheckedAt: observation?.observed_at ?? tracked?.last_checked_at ?? null,
    };
  }));
  const initialDecisions = Object.fromEntries(workspaceKeywords.flatMap((keyword) => {
    const preference = preferenceByNormalized.get(normalizeTrackedKeyword(keyword.keyword));
    return preference?.decision === "approved" || preference?.decision === "declined" ? [[keyword.keyword, preference.decision]] : [];
  })) as Record<string, "approved" | "declined">;
  const initialReasons = Object.fromEntries(workspaceKeywords.flatMap((keyword) => {
    const preference = preferenceByNormalized.get(normalizeTrackedKeyword(keyword.keyword));
    return preference ? [[keyword.keyword, preference.reason]] : [];
  })) as Record<string, string | null>;
  const { data: reoptimizationDocuments } = context.audit
    ? await (context.supabase as unknown as SupabaseClient).from("reoptimization_documents").select("id,normalized_keyword").eq("audit_id", context.audit.id).eq("status", "active")
    : { data: [] };
  const initialDocumentLinks = Object.fromEntries((reoptimizationDocuments ?? []).map((document) => [document.normalized_keyword, `/reoptimization/${document.id}`]));
  const documentLinksByKeyword = Object.fromEntries(workspaceKeywords.flatMap((keyword) => {
    const href = initialDocumentLinks[normalizeTrackedKeyword(keyword.keyword)];
    return href ? [[keyword.keyword, href]] : [];
  }));
  const approvedCount = Object.values(initialDecisions).filter((decision) => decision === "approved").length;
  const declinedCount = Object.values(initialDecisions).filter((decision) => decision === "declined").length;
  const pendingCount = workspaceKeywords.filter((keyword) => !initialDecisions[keyword.keyword]).length;
  const contentQuest = context.quests.find((quest) => quest.audit_id === context.audit?.id && quest.task_type === "content_review");
  const { count: articleDraftCount } = context.website && context.audit
    ? await (context.supabase as unknown as SupabaseClient).from("article_drafts").select("id", { count: "exact", head: true }).eq("website_id", context.website.id).eq("audit_id", context.audit.id)
    : { count: 0 };
  const keywordPolicy = await runDestinyServerLogic({
    auditComplete: context.audit?.status === "complete" ? 1 : 0,
    criticalIssues: Number(context.metrics?.critical_issues ?? 0),
    warnings: Number(context.metrics?.warnings ?? 0),
    rankingKeywords: Number(context.metrics?.ranking_keywords ?? 0),
    newKeywords: Number(context.metrics?.new_keywords ?? 0),
    lostKeywords: Number(context.metrics?.lost_keywords ?? 0),
    contentGaps: Number(context.metrics?.content_gaps ?? 0),
    reviewCount: Number(context.metrics?.google_reviews ?? 0),
    keywordStrategyComplete: keywordQuest?.status === "complete" && approvedCount >= INITIAL_KEYWORD_APPROVAL_TARGET ? 1 : 0,
    keywordPendingRecommendations: pendingCount,
    keywordApprovedDecisions: approvedCount,
    keywordDeclinedDecisions: declinedCount,
    keywordArticleDrafts: articleDraftCount ?? 0,
    keywordContentComplete: contentQuest?.status === "complete" ? 1 : 0,
  });
  const websiteQuery = context.website?.id ? `?site=${encodeURIComponent(context.website.id)}` : "";
  const nextActions = {
    review_keywords: { code: "review_keywords" as const, href: "#keyword-strategy-tabs", label: "Review keyword recommendations", description: "Choose the searches that match the business and set the direction for the first plan." },
    create_first_article: { code: "create_first_article" as const, href: `/content${websiteQuery}#article-review-workspace`, label: "Create your first article", description: "Turn the strongest approved keyword into this week’s first useful article." },
    review_weekly_content: { code: "review_weekly_content" as const, href: `/content${websiteQuery}#article-review-workspace`, label: "Review this week’s content", description: "Shape, approve, and deliver the drafts created from the approved strategy." },
    track_progress: { code: "track_progress" as const, href: `/rank-tracker${websiteQuery}`, label: "Track keyword progress", description: "See how the approved searches are moving after the content work is live." },
  };
  const nextAction = nextActions[keywordPolicy.keywordNextStep];
  const strategyComplete = keywordQuest?.status === "complete" && approvedCount >= INITIAL_KEYWORD_APPROVAL_TARGET;
  const reviewedCount = approvedCount + declinedCount;
  const approvedStrategyKeywords = new Set((savedPreferences ?? []).filter((preference) => preference.decision === "approved").map((preference) => preference.normalized_keyword));
  const watchlistCount = keywordWatchlistCount(trackedKeywords ?? [], approvedStrategyKeywords);
  const auditDate = context.audit?.created_at ? new Date(context.audit.created_at) : null;
  const dateLabel = (date: Date | null) => date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;
  const latestRankCheck = workspaceKeywords.flatMap((keyword) => keyword.rankCheckedAt ? [new Date(keyword.rankCheckedAt)] : []).filter((date) => !Number.isNaN(date.getTime())).sort((left, right) => right.getTime() - left.getTime())[0] ?? null;
  const auditMeta = [
    `${reviewedCount} keyword${reviewedCount === 1 ? "" : "s"} reviewed`,
    dateLabel(auditDate) ? `Last audit ${dateLabel(auditDate)}` : null,
    dateLabel(latestRankCheck) ? `Rankings checked ${dateLabel(latestRankCheck)}` : "Rank readings begin after approval",
  ].filter(Boolean).join(" · ");
  return <WorkspaceShell active="/keywords" design="claude-keyword-strategy" eyebrow="Keyword strategy" title={strategyComplete ? "Your strategy is set." : "Choose your keyword strategy."} description={auditMeta}>
    <StrategyPipelineStrip active="keywords" approvedKeywords={approvedCount} contentDrafts={articleDraftCount ?? 0} watchedKeywords={watchlistCount} />
    {!vocabulary.length ? <WorkspaceEmpty title="Keyword strategy is not ready" description="Run a live audit so Rebound SEO can inspect up to five important pages and build the initial recommendations." /> : <>
      {context.audit && <KeywordStrategyReview websiteId={context.website?.id ?? ""} auditHref={`/audits/${context.audit.id}`} auditId={context.audit.id} initialDecisions={initialDecisions} initialDocumentLinks={documentLinksByKeyword} initialReasons={initialReasons} newResearchStatus={newResearch.status} initialTab={workspaceKeywords.some((keyword) => keyword.verdict === "create" && !initialDecisions[keyword.keyword]) ? "review" : keywordPolicy.keywordWorkspaceTab} keywords={workspaceKeywords} moreKeywordsHref={`/keyword-research?site=${context.website?.id ?? ""}&from=strategy`} nextAction={nextAction} nextHref={`/content?site=${context.website?.id ?? ""}&strategy=complete`} questId={keywordQuest?.id} questStatus={keywordQuest?.status} />}
      <section className="workspace-card"><div className="workspace-card-heading"><div><strong>Verified pages inspected</strong><small>Only real strategic pages from the live site; blog posts and guessed URLs are excluded</small></div><span>{pages.length} page{pages.length === 1 ? "" : "s"}</span></div><div className="evidence-page-list">{pages.map((page, index) => <a href={String(page.url)} key={`${String(page.url)}-${index}`} rel="noreferrer" target="_blank"><span>{String(page.role).replaceAll("_", " ")}</span><strong>{String(page.title || page.url)}</strong><small>{String(page.url)}</small></a>)}</div></section>
      <details className="workspace-card keyword-methodology"><summary><span><strong>How Rebound SEO prioritized these keywords</strong><small>Open the research and scoring method</small></span><b>View method</b></summary><div><section><div className="workspace-card-heading"><div><strong>Business understanding</strong><small>Verified site pages plus your onboarding answers</small></div><span>{vocabulary.length} evidence terms</span></div><div className="vocabulary-cloud">{vocabulary.slice(0, 40).map((term) => <span key={String(term.normalized)} title={String(term.evidence)}>{String(term.term)} <b>{Number(term.weight).toFixed(1)}</b></span>)}</div></section><section><div className="workspace-card-heading"><div><strong>Revenue-opportunity scoring</strong><small>Search intent + monthly demand + attainable difficulty + CPC value + current rank or competitor gap</small></div><span>{usableKeywords.length} current recommendations</span></div><p className="keyword-method-note">Transactional and commercial searches lead when demand is meaningful. Informational topics remain in the pool when they support the business, but raw volume alone cannot outrank a stronger path to revenue. Approved and declined choices remain attached to this website and guide later recommendations.</p></section></div></details>
    </>}
  </WorkspaceShell>;
}
