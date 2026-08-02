import { ArticleReviewWorkspace } from "@/components/article-review-workspace";
import { FeatureJourneyCallout } from "@/components/feature-journey-callout";
import { WorkspaceEmpty } from "@/components/workspace-empty";
import { WorkspaceShell } from "@/components/workspace-shell";
import Link from "next/link";
import { buildArticleDraft } from "@/lib/content/article-draft";
import { SEARCH_INTENT_DEFINITIONS, buildEditorialCalendar, inferBusinessModel, selectKeywordsForCalendar } from "@/lib/content/editorial-calendar";
import { rankKeywordOpportunities } from "@/lib/seo/keyword-opportunity";
import { getWorkspaceContext, list, providerResultFromMetrics, record } from "@/lib/workspace-context";

export default async function ContentPage() {
  const context = await getWorkspaceContext();
  const providerResult = providerResultFromMetrics(context.metrics);
  const keywordRecords = list(providerResult.keywords).map(record);
  const rankedKeywords = rankKeywordOpportunities(keywordRecords.flatMap((keyword) => typeof keyword.keyword === "string" ? [{
    keyword: keyword.keyword,
    intent: String(keyword.intent || keyword.providerIntent || "informational"),
    opportunity: String(keyword.opportunity || "site_idea"),
    searchVolume: Number(keyword.searchVolume ?? 0),
    difficulty: Number(keyword.difficulty ?? 0),
    rank: Number(keyword.rank ?? 0),
    cpc: Number(keyword.cpc ?? 0),
    competitorRankers: Number(keyword.competitorRankers ?? 0),
  }] : []), {
    productsServices: context.website?.products_services ?? "",
    problemSolved: context.website?.problem_solved ?? "",
    idealCustomer: context.website?.ideal_customer ?? "",
    audienceChallengesGoals: context.website?.audience_challenges_goals ?? "",
    market: context.website?.market ?? "",
  }, 50);
  const { data: savedKeywordDecisions } = context.audit ? await context.supabase.from("keyword_decisions").select("keyword,decision").eq("audit_id", context.audit.id) : { data: [] };
  const keywordDecisions = Object.fromEntries((savedKeywordDecisions ?? []).map((item) => [item.keyword, item.decision])) as Record<string, "approved" | "declined">;
  const keywords = selectKeywordsForCalendar(rankedKeywords, keywordDecisions);
  const pages = list(providerResult.pages).map(record).filter((item) => typeof item.url === "string");
  const calendar = buildEditorialCalendar(keywords.map((keyword) => ({ ...keyword, intent: keyword.providerIntent })), 24, inferBusinessModel(context.website?.products_services ?? ""));
  const approvalQuest = context.quests.find((quest) => quest.audit_id === context.audit?.id && quest.task_type === "content_review");
  const articleDrafts = calendar.slice(0, 3).map((item) => buildArticleDraft({
    keyword: item.focusKeyword,
    businessName: context.website?.business_name ?? "Your business",
    problemSolved: context.website?.problem_solved ?? "",
    idealCustomer: context.website?.ideal_customer ?? "",
    differentiation: context.website?.differentiation ?? "",
  }));

  return (
    <WorkspaceShell active="/content" eyebrow={context.website?.normalized_domain ?? "Destiny workspace"} title="Content creation" description="Review three editable articles this week, then approve CMS delivery or download Word documents for your team.">
      <FeatureJourneyCallout milestone="First content published" description="Reviewing and approving a useful article is an effort milestone. Destiny will separately verify when search engines begin showing it." />
      {!rankedKeywords.length ? <WorkspaceEmpty title="Keyword strategy is not ready" description="Run an audit to populate the live search-intent opportunity pool." /> : !keywords.length ? <WorkspaceEmpty title="Approve keywords to build the calendar" description="Every reviewed keyword is currently declined. Return to Keyword strategy and approve the searches Destiny should use." /> : (
        <>
        <section className="workspace-card content-workflow"><div><span>1</span><strong>Three outlines ready</strong><small>Built from your keyword strategy</small></div><div className={approvalQuest?.status === "complete" ? "done" : "active"}><span>2</span><strong>Generate, review & approve</strong><small>Research-backed drafts with your direction</small></div><div><span>3</span><strong>Choose delivery</strong><small>CMS connection or editable Word document</small></div><div className="content-workflow-actions"><Link className="secondary-button" href="/integrations">Connect CMS</Link></div></section>
        <ArticleReviewWorkspace
          auditId={context.audit?.id ?? "latest"}
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
          initialDrafts={articleDrafts}
          questId={approvalQuest?.id}
          questStatus={approvalQuest?.status}
        />
        <section className="workspace-card">
          <div className="workspace-card-heading editorial-calendar-heading">
            <div><strong>Editorial calendar</strong><small>{String(providerResult.sourceLabel ?? "Saved audit data")}</small></div>
            <div className="editorial-calendar-meta">
              <span>{calendar.length} weeks · 6 months</span>
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
