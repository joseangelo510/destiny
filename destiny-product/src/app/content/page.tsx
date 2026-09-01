import { ArticleReviewWorkspace } from "@/components/article-review-workspace";
import { PublishingPlanManager } from "@/components/publishing-plan-manager";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FeatureJourneyCallout } from "@/components/feature-journey-callout";
import { WorkspaceEmpty } from "@/components/workspace-empty";
import { WorkspaceShell } from "@/components/workspace-shell";
import { WorkspaceLink as Link } from "@/components/workspace-link";
import { StrategyPipelineStrip } from "@/components/strategy-pipeline-strip";
import { buildArticleDraft, buildPersistedArticleDraftSeeds, mergePersistedArticleDrafts } from "@/lib/content/article-draft";
import { articleGenerationCapability } from "@/lib/content/article-generation";
import { SEARCH_INTENT_DEFINITIONS, buildEditorialCalendar, inferBusinessModel, mergeApprovedSavedKeywords, selectKeywordsForCalendar } from "@/lib/content/editorial-calendar";
import { parseBuilderProfile } from "@/lib/integrations/website-profile";
import { INITIAL_PLAN_MONTHS, INITIAL_PLAN_WEEKS } from "@/lib/product/plan-horizon";
import { rankKeywordOpportunities } from "@/lib/seo/keyword-opportunity";
import { normalizeTrackedKeyword } from "@/lib/seo/rank-tracker";
import { buildRepurposeArticleDraft } from "@/lib/content/repurpose-handoff";
import { parseInterviewArticleDraft } from "@/lib/interviews/interviews";
import type { PublishingPlanRecord, PublishingScheduleItemRecord } from "@/lib/content/publishing-plan";
import { contentWorkspaceEmptyState } from "@/lib/content/content-workspace";
import { getWorkspaceContext, list, providerResultFromMetrics, record } from "@/lib/workspace-context";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function ContentPage({ searchParams }: { searchParams: Promise<{ strategy?: string; repurpose?: string; interview?: string }> }) {
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
  const [{ data: savedKeywordPreferences }, { data: pipelineTrackedKeywords }, { data: interlinkRun }] = context.website ? await Promise.all([
    context.supabase.from("keyword_preferences").select("keyword,normalized_keyword,decision,provider_intent,search_volume,difficulty,theme_id,theme_label").eq("website_id", context.website.id),
    context.supabase.from("tracked_keywords").select("source").eq("website_id", context.website.id).neq("status", "paused"),
    (context.supabase as unknown as SupabaseClient).from("interlink_runs").select("manifest").eq("website_id", context.website.id).eq("status", "complete").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]) : [{ data: [] }, { data: [] }, { data: null }];
  const interlinkPages = list(record(interlinkRun?.manifest).pages).map(record).filter((page) => Number(page.statusCode) === 200 && page.indexable === true && typeof page.url === "string");
  const generationPages = interlinkPages.length ? interlinkPages : pages;
  const preferenceByNormalized = new Map((savedKeywordPreferences ?? []).map((item) => [item.normalized_keyword, item]));
  const calendarKeywordPool = mergeApprovedSavedKeywords(rankedKeywords, savedKeywordPreferences ?? []);
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
    keywords.map((keyword) => ({
      ...keyword,
      intent: "providerIntent" in keyword ? String(keyword.providerIntent) : keyword.intent,
    })),
    INITIAL_PLAN_WEEKS,
    businessModel,
    editorialContext,
  );
  const approvalQuest = context.quests.find((quest) => quest.audit_id === context.audit?.id && quest.task_type === "content_review");
  const wordpress = context.integrations.find((integration) => integration.provider === "wordpress");
  const webflow = context.integrations.find((integration) => integration.provider === "webflow");
  const builderProfile = parseBuilderProfile(context.website?.builder_profile);
  const { data: repurposeSourceRow } = context.website && params.repurpose && UUID_PATTERN.test(params.repurpose)
    ? await (context.supabase as unknown as SupabaseClient)
      .from("repurpose_sources")
      .select("id,output_type,target_keyword,source_kind,source_name,source_url,status,draft_title,draft_body,draft_metadata")
      .eq("id", params.repurpose)
      .eq("website_id", context.website.id)
      .eq("output_type", "seo_blog_article")
      .eq("status", "ready")
      .maybeSingle()
    : { data: null };
  const repurposeArticleDraft = buildRepurposeArticleDraft(repurposeSourceRow);
  const { data: interviewArticleRow } = context.website && context.audit && params.interview && UUID_PATTERN.test(params.interview)
    ? await (context.supabase as unknown as SupabaseClient)
      .from("article_drafts")
      .select("draft")
      .eq("website_id", context.website.id)
      .eq("audit_id", context.audit.id)
      .eq("interview_id", params.interview)
      .maybeSingle()
    : { data: null };
  const interviewArticleDraft = parseInterviewArticleDraft(interviewArticleRow?.draft);
  const calendarArticleDrafts = calendar.slice(0, 3).map((item) => buildArticleDraft({
    keyword: item.focusKeyword,
    businessName: context.website?.business_name ?? "Your business",
    problemSolved: context.website?.problem_solved ?? "",
    idealCustomer: context.website?.ideal_customer ?? "",
    differentiation: context.website?.differentiation ?? "",
  }));
  const articleDrafts = [
    ...(interviewArticleDraft ? [interviewArticleDraft] : []),
    ...(repurposeArticleDraft ? [repurposeArticleDraft] : []),
    ...calendarArticleDrafts.filter((draft) => draft.keyword !== repurposeArticleDraft?.keyword && draft.keyword !== interviewArticleDraft?.keyword),
  ].slice(0, 3);
  const { data: savedArticleDraftRows } = context.audit && context.website
    ? await (context.supabase as unknown as SupabaseClient)
      .from("article_drafts")
      .select("draft")
      .eq("website_id", context.website.id)
      .eq("audit_id", context.audit.id)
    : { data: [] };
  const savedArticleDrafts = (savedArticleDraftRows ?? []).map((row) => row.draft);
  const articleDraftSeeds = buildPersistedArticleDraftSeeds(articleDrafts, savedArticleDrafts, {
    businessName: context.website?.business_name ?? "Your business",
    problemSolved: context.website?.problem_solved ?? "",
    idealCustomer: context.website?.ideal_customer ?? "",
    differentiation: context.website?.differentiation ?? "",
  });
  const hydratedArticleDrafts = mergePersistedArticleDrafts(articleDraftSeeds, savedArticleDrafts);
  const generatedArticleCount = hydratedArticleDrafts.filter((draft) => draft.generationStatus === "generated").length;
  const { data: cmsTransferRows } = context.website
    ? await (context.supabase as unknown as SupabaseClient).rpc("read_cms_transfer_states", { p_website_id: context.website.id })
    : { data: [] };
  const initialCmsTransfers = Array.isArray(cmsTransferRows) ? cmsTransferRows : [];
  const { data: publishingPlanRow } = context.website && context.audit
    ? await (context.supabase as unknown as SupabaseClient)
      .from("publishing_plans")
      .select("id,mode,status,timezone,holdback_hours,start_date,end_date,confirmed_post_count,automatic_confirmed_at")
      .eq("website_id", context.website.id)
      .eq("audit_id", context.audit.id)
      .maybeSingle()
    : { data: null };
  const { data: publishingItemRows } = publishingPlanRow
    ? await (context.supabase as unknown as SupabaseClient)
      .from("publishing_schedule_items")
      .select("id,plan_id,position,keyword,title,content_type,related_article_title,scheduled_for,state,review_recommended,remote_id,remote_edit_url,remote_permalink,last_error")
      .eq("plan_id", publishingPlanRow.id)
      .order("position")
    : { data: [] };
  const publishingPlan = publishingPlanRow as PublishingPlanRecord | null;
  const publishingItems = (publishingItemRows ?? []) as PublishingScheduleItemRecord[];
  const wordpressScheduleByKeyword: Record<string, string> = {};
  if (publishingPlan?.status === "active" && publishingPlan.mode !== "review_each") {
    for (const item of publishingItems) {
      if (item.state === "published" || item.state === "managed_externally") continue;
      const keyword = normalizeTrackedKeyword(item.keyword);
      if (!wordpressScheduleByKeyword[keyword]) wordpressScheduleByKeyword[keyword] = item.scheduled_for;
    }
  }
  const approvedKeywordCount = (savedKeywordPreferences ?? []).filter((item) => item.decision === "approved").length;
  const watchlistCount = (pipelineTrackedKeywords ?? []).filter((item) => item.source !== "strategy").length;
  const strategyContentReady = rankedKeywords.length > 0 && approvedKeywordCount > 0 && keywords.length > 0;
  const emptyState = contentWorkspaceEmptyState({
    approvedKeywordCount,
    directDraft: Boolean(repurposeArticleDraft || interviewArticleDraft),
    rankedKeywordCount: rankedKeywords.length,
    savedDraftCount: hydratedArticleDrafts.length,
    selectedKeywordCount: keywords.length,
  });

  return (
    <WorkspaceShell active="/content" eyebrow={context.website?.normalized_domain ?? "Rebound SEO workspace"} title="Content creation" description="Review three editable articles this week, then approve CMS delivery or download Word documents for your team.">
      <StrategyPipelineStrip active="content" approvedKeywords={approvedKeywordCount} contentDrafts={generatedArticleCount} watchedKeywords={watchlistCount} />
      {params.strategy === "complete" && <div aria-live="polite" className="integration-banner success" role="status"><strong>Keyword strategy saved</strong><p>Your approved searches are now powering the three-month content plan below.</p></div>}
      <FeatureJourneyCallout actionHref="#article-review-workspace" actionLabel="Review the first article" milestone="Get ready to be found" description="Turn an approved keyword into one useful, reviewable article." doneLooksLike="A draft is approved for CMS delivery or saved as an editable document." evidence="Your approval and delivery result; search performance remains separately verified." />
      {emptyState ? <WorkspaceEmpty title={emptyState.title} description={emptyState.description} /> : (
        <>
        <section className="workspace-card content-workflow"><div><span>1</span><strong>{interviewArticleDraft ? "Interview draft ready" : repurposeArticleDraft ? "Repurposed draft ready" : "Three outlines ready"}</strong><small>{interviewArticleDraft ? "Built from your exact interview answers" : repurposeArticleDraft ? "Loaded from your saved source" : "Built from your keyword strategy"}</small></div><div className={approvalQuest?.status === "complete" ? "done" : "active"}><span>2</span><strong>Generate, review & approve</strong><small>Research-backed drafts with your direction</small></div><div><span>3</span><strong>Choose delivery</strong><small>CMS connection or editable Word document</small></div><div className="content-workflow-actions"><Link className="secondary-button" href="/integrations">Connect CMS</Link></div></section>
        {strategyContentReady && <PublishingPlanManager
          approvedKeywordCount={approvedKeywordCount}
          websiteId={context.website?.id ?? ""}
          auditId={context.audit?.id ?? ""}
          calendar={calendar}
          wordpressConnected={wordpress?.status === "connected"}
          webflowConnected={webflow?.status === "connected"}
          websitePlatform={builderProfile.platform}
          initialPlan={publishingPlan}
          initialItems={publishingItems}
        />}
        <ArticleReviewWorkspace
          auditId={context.audit?.id ?? "latest"}
          websiteId={context.website?.id ?? ""}
          wordpressConnected={wordpress?.status === "connected"}
          webflowConnected={webflow?.status === "connected"}
          initialCmsTransfers={initialCmsTransfers}
          wordpressScheduleByKeyword={wordpressScheduleByKeyword}
          generationContext={{
            businessName: context.website?.business_name ?? "Your business",
            problemSolved: context.website?.problem_solved ?? "",
            idealCustomer: context.website?.ideal_customer ?? "",
            differentiation: context.website?.differentiation ?? "",
            internalPages: generationPages.slice(0, 20).map((page) => ({
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
        {strategyContentReady && <section className="workspace-card">
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
        </section>}
        </>
      )}
    </WorkspaceShell>
  );
}
