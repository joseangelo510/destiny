import { ArticleReviewWorkspace } from "@/components/article-review-workspace";
import { FeatureJourneyCallout } from "@/components/feature-journey-callout";
import { WorkspaceEmpty } from "@/components/workspace-empty";
import { WorkspaceShell } from "@/components/workspace-shell";
import Link from "next/link";
import { buildArticleDraft } from "@/lib/content/article-draft";
import { SEARCH_INTENT_DEFINITIONS, buildEditorialCalendar } from "@/lib/content/editorial-calendar";
import { getWorkspaceContext, list, providerResultFromMetrics, record } from "@/lib/workspace-context";

export default async function ContentPage() {
  const context = await getWorkspaceContext();
  const providerResult = providerResultFromMetrics(context.metrics);
  const keywords = list(providerResult.keywords).map(record).filter((item) => typeof item.keyword === "string" && item.verdict !== "reject");
  const pages = list(providerResult.pages).map(record).filter((item) => typeof item.url === "string");
  const calendar = buildEditorialCalendar(keywords.map((keyword) => ({
    keyword: String(keyword.keyword),
    intent: String(keyword.intent || "informational"),
    opportunity: String(keyword.opportunity || "site_idea"),
    searchVolume: Number(keyword.searchVolume ?? 0),
    difficulty: Number(keyword.difficulty ?? 0),
    rank: Number(keyword.rank ?? 0),
  })));
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
      {!keywords.length ? <WorkspaceEmpty title="Keyword strategy is not ready" description="Run an audit to populate ranked keywords. Live DataForSEO credentials will replace the explicitly labeled demo keyword set." /> : (
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
            <div className="content-row content-head"><span>Schedule</span><span>Content type</span><span>Title</span><span>Search intent</span><span>Focus keyword</span><span>SEO evidence</span><span>Status</span></div>
            {calendar.map((item, index) => {
              const intentDefinition = SEARCH_INTENT_DEFINITIONS[item.searchIntent];
              return (
                <div className="content-row" key={`${item.focusKeyword}-${index}`}>
                  <span data-label="Schedule"><strong>Month {item.month}</strong><small>Week {item.week}</small></span>
                  <span data-label="Content type"><strong>{item.contentType}</strong></span>
                  <span data-label="Title"><strong>{item.title}</strong></span>
                  <span data-label="Search intent"><strong className={`intent-chip ${item.searchIntent}`}>{intentDefinition.label}</strong><small>{intentDefinition.summary}</small></span>
                  <span data-label="Focus keyword"><strong>{item.focusKeyword}</strong></span>
                  <span data-label="SEO evidence"><strong>{item.searchVolume.toLocaleString()} searches</strong><small>{item.evidence} · Difficulty {item.difficulty}</small></span>
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
