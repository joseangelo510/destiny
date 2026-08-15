import { ArticleReviewWorkspace } from "@/components/article-review-workspace";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FeatureJourneyCallout } from "@/components/feature-journey-callout";
import { WorkspaceEmpty } from "@/components/workspace-empty";
import { WorkspaceShell } from "@/components/workspace-shell";
import { WorkspaceLink as Link } from "@/components/workspace-link";
import { StrategyPipelineStrip } from "@/components/strategy-pipeline-strip";
import { buildArticleDraft, mergePersistedArticleDrafts } from "@/lib/content/article-draft";
import { articleGenerationCapability } from "@/lib/content/article-generation";
import { SEARCH_INTENT_DEFINITIONS, buildEditorialCalendar, inferBusinessModel, selectKeywordsForCalendar } from "@/lib/content/editorial-calendar";
import { INITIAL_PLAN_MONTHS, INITIAL_PLAN_WEEKS } from "@/lib/product/plan-horizon";
import { mergeSavedApprovedKeywords } from "@/lib/content/saved-keyword-merge";
import { rankKeywordOpportunities } from "@/lib/seo/keyword-opportunity";
import { normalizeTrackedKeyword } from "@/lib/seo/rank-tracker";
import { getWorkspaceContext, list, providerResultFromMetrics, record } from "@/lib/workspace-context";

export default async function ContentPage({ searchParams }: { searchParams: Promise<{ strategy?: string }> }) {
  const params = await searchParams;
  const generationCapability = articleGenerationCapability(process.env.ANTHROPIC_API_KEY, process.env.ANTHROPIC_COPY_MODEL);
  const context = await getWorkspaceContext();
  const providerResult = providerResultFromMetrics(context.metrics);
  const keywordRecords = list(providerResult.keywords).map(record);
  const pages = list(providerResult.pages).map(record).filter((item) => typeof item.url === "string");
  const strategicPages = pages.filter((page) => String(page.role || "other") !== "other"
    && !/\/(?:blog|news|articles?|category|tag|uncategorized)(?:\/|$)/i.test(String(page.url || "")));
  const locationEvidence = strategicPages.map((page) => String(page.text || "")).join(" ");
  const rankedKeywords = rankKeywordOpportunities(keywordRecords.flatMap((keyword) => typeof keyword.keyword === "string" ? [{
    keyword: keyword.keyword,
    intent: String(keyword.intent || keyword.providerIntent || "informational"),
    opportunity: String(keyword.opportunity || "site_idea"),
    searchVolume: Number(keyword.searchVolume ?? 0),
    difficulty: Number(keyword.difficulty ?? 0),
    rank: Number(keyword.rank ?? 0),
    cpc: Number(keyword.cpc ?? 0),
    competitorRankers: Number(keyword.competitorRankers ?? 0),
    themeId: typeof keyword.themeId === "string" ? keyword.themeId : undefined,
    themeLabel: typeof keyword.themeLabel === "string" ? keyword.themeLabel : undefined,
    themeRole: typeof keyword.themeRole === "string" ? keyword.themeRole : undefined,
  }] : []), {
    productsServices: context.website?.products_services ?? "",
    problemSolved: context.website?.problem_solved ?? "",
    idealCustomer: context.website?.ideal_customer ?? "",
    audienceChallengesGoals: context.website?.audience_challenges_goals ?? "",
    market: context.website?.market ?? "",
    locationEvidence,
  }, 50);
  const [{ data: savedKeywordPreferences }, { data: pipelineTrackedKeywords }] = context.website ? await Promise.all([
    context.supabase.from("keyword_preferences").select("keyword,normalized_keyword,decision,provider_intent,search_volume,difficulty").eq("website_id", context.website.id),
    context.supabase.from("tracked_keywords").select("source").eq("website_id", context.website.id).neq("status", "paused"),
  ]) : [{ data: [] }, { data: [] }];
  const preferenceByNormalized = new Map((savedKeywordPreferences ?? []).map((item) => [item.normalized_keyword, item]));
  // Approved website preferences saved from later Keyword Research join the audit
  // pool here; declined and zero-volume saved phrases never reach the calendar.
  const calendarKeywordPool = mergeSavedApprovedKeywords(rankedKeywords, savedKeywordPreferences ?? []);
  const keywordDecisions = Object.fromEntries(calendarKeywordPool.flatMap((keyword) => {
    const preference = preferenceByNormalized.get(normalizeTrackedKeyword(keyword.keyword));
    return preference?.decision === "approved" || preference?.decision === "declined" ? [[keyword.keyword, preference.decision]] : [];
  })) as Record<string, "approved" | "declined">;
  const editorialContext = {
    productsServices: context.website?.products_services ?? "",
    locationEvidence,
    competitorNames: context.competitors.map((competitor) => competitor.name),
  };
  const keywords = selectKeywordsForCalendar(calendarKeywordPool, keywordDecisions, editorialContext);
  const businessModel = await inferBusinessModel(context.website?.products_services ?? "");
  const calendar = await buildEditorialCalendar(
    keywords.map((keyword) => ({ ...keyword, intent: keyword.providerIntent })),
    INITIAL_PLAN_WEEKS,
    businessModel,
    editorialContext,
  );
  const approvalQuest = context.quests.find((quest) => quest.audit_id === context.audit?.id && quest.task_type === "content_review");
  const wordpress = context.integrations.find((integration) => integration.provider === "wordpress");
  const webflow = context.integrations.find((integration) => integration.provider === "webflow");
  const articleDrafts = calendar.slice(0, 3).map((item) => buildArticleDraft({
    keyword: item.focusKeyword,
    businessName: context.website?.business_name ?? "Your business",
    problemSolved: context.website?.problem_solved ?? "",
    idealCustomer: context.website?.ideal_customer ?? "",
    differentiation: context.website?.differentiation ?? "",
  }));
  const { data: savedArticleDraftRows } = context.audit && context.website
    ? await (context.supabase as unknown as SupabaseClient)
      .from("article_drafts")
      .select("draft")
      .eq("website_id", context.website.id)
      .eq("audit_id", context.audit.id)
    : { data: [] };
  const hydratedArticleDrafts = mergePersistedArticleDrafts(articleDrafts, (savedArticleDraftRows ?? []).map((row) => row.draft));
  const { data: cmsTransferRows } = context.website
    ? await (context.supabase as unknown as SupabaseClient).rpc("read_cms_transfer_states", { p_website_id: context.website.id })
    : { data: [] };
  const initialCmsTransfers = Array.isArray(cmsTransferRows) ? cmsTransferRows : [];
  const approvedKeywordCount = (savedKeywordPreferences ?? []).filter((item) => item.decision === "approved").length;
  const watchlistCount = (pipelineTrackedKeywords ?? []).filter((item) => item.source !== "strategy").length;

  return (
    <WorkspaceShell active="/content" eyebrow={context.website?.normalized_domain ?? "Destiny workspace"} title="Content creation" description="Review three editable articles this week, then approve CMS delivery or download Word documents for your team.">
      <StrategyPipelineStrip active="content" approvedKeywords={approvedKeywordCount} contentDrafts={hydratedArticleDrafts.length} watchedKeywords={watchlistCount} />
      {params.strategy === "complete" && <div aria-live="polite" className="integration-banner success" role="status"><strong>Keyword strategy saved</strong><p>Your approved searches are now powering the three-month content plan below.</p></div>}
      <FeatureJourneyCallout actionHref="#article-review-workspace" actionLabel="Review the first article" milestone="Get ready to be found" description="Turn an approved keyword into one useful, reviewable article." doneLooksLike="A draft is approved for CMS delivery or saved as an editable document." evidence="Your approval and delivery result; search performance remains separately verified." />
      {!calendarKeywordPool.length ? <WorkspaceEmpty title="Keyword strategy is not ready" description="Run an audit to populate the live search-intent opportunity pool, or approve keywords from Keyword research." /> : !keywords.length ? <WorkspaceEmpty title="Approve keywords to build the calendar" description="Every reviewed keyword is currently declined. Return to Keyword strategy and approve the searches Destiny should use." /> : (
        <>
        <section className="workspace-card content-workflow"><div><span>1</span><strong>Three outlines ready</strong><small>Built from your keyword strategy</small></div><div className={approvalQuest?.status === "complete" ? "done" : "active"}><span>2</span><strong>Generate, review & approve</strong><small>Research-backed drafts with your direction</small></div><div><span>3</span><strong>Choose delivery</strong><small>CMS connection or editable Word document</small></div><div className="content-workflow-actions"><Link className="secondary-button" href="/integrations">Connect CMS</Link></div></section>
        <ArticleReviewWorkspace
          auditId={context.audit?.id ?? "latest"}
          websiteId={context.website?.id ?? ""}
          wordpressConnected={wordpress?.status === "connected"}
          webflowConnected={webflow?.status === "connected"}
          initialCmsTransfers={initialCmsTransfers}
          generationContext={{
            businessName: context.website?.business_name ?? "Your business",
            problemSolved: context.website?.problem_solved ?? "",
            idealCustomer: context.website?.ideal_customer ?? "",
            differentiation: context.website?.differentiation ?? "",
            internalPages: pages.map((page) => ({
              title: String(page.title || page.url),
              url: String(page.url),
              text: typeof page.text === "string" ? page.text : undefined,
            })),
          }}
          generationAvailable={generationCapability.available}
          generationModelLabel={generationCapability.label}
          initialDrafts={hydratedArticleDrafts}
          questId={approvalQuest?.id}
          questStatus={approvalQuest?.status}
        />
        <section className="workspace-card">
          <div className="workspace-card-heading editorial-calendar-heading">
            <div><strong>Editorial calendar</strong><small>{String(providerResult.sourceLabel ?? "Saved audit data")}</small></div>
            <div className="editorial-calendar-meta">
              <span>{calendar.length} weeks · {INITIAL_PLAN_MONTHS} months</span>
              <span className="intent-help">
                <span>Search intent</span>
                <button type="button" aria-label="What do the search intent stages mean?" aria-describedby="search-intent-help">i</button>
                <span className="intent-tooltip" id="search-intent-help" role="tooltip">
                  <strong>Search intent</strong>
                  {(Object.keys(SEARCH_INTENT_DEFINITIONS) as Array<keyof typeof SEARCH_INTENT_DEFINITIONS>).map((intent) => (
                    <span className="intent-tooltip-row" key={intent}>
                      <b>{SEARCH_INTENT_DEFINITIONS[intent].label}</b>
                      <small>{SEARCH_INTENT_DEFINITIONS[intent].description}</small>
                    </span>
                  ))}
                </span>
              </span>
            </div>
          </div>
          <div className="content-table">
            <div className="content-row content-head"><span>Schedule</span><span>Content type</span><span>Focus keyword</span><span>Monthly Searches</span><span>Title</span><span>Search intent</span><span>Status</span></div>
            {calendar.map((item, index) => {
              const intentDefinition = SEARCH_INTENT_DEFINITIONS[item.searchIntent];
              return (
                <div className="content-row" key={`${item.focusKeyword}-${index}`}>
                  <span className="editorial-schedule" data-label="Schedule"><small>Month {item.month}</small><strong>Week {item.week}</strong></span>
                  <span data-label="Content type"><strong>{item.contentType}</strong></span>
                  <span data-label="Focus keyword"><strong>{item.focusKeyword}</strong></span>
                  <span data-label="Monthly Searches"><strong>{item.searchVolume.toLocaleString()}</strong><small>{item.priorityReason} · Difficulty {item.difficulty}</small></span>
                  <span data-label="Title"><strong>{item.title}</strong></span>
                  <span data-label="Search intent"><strong className={`intent-chip ${item.searchIntent}`}>{intentDefinition.label}</strong><small>{intentDefinition.summary}</small></span>
                  <span data-label="Status"><span className={`status-chip ${index < 3 ? "" : "amber"}`}>{index < 3 && approvalQuest?.status === "complete" ? "Approved for delivery" : item.status}</span></span>
                </div>
              );
            })}
          </div>
        </section>
        </>
      )}
    </WorkspaceShell>
  );
}
