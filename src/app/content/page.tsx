import { ArticleReviewWorkspace } from "@/components/article-review-workspace";
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
      {!keywords.length ? <WorkspaceEmpty title="Keyword strategy is not ready" description="Run an audit to populate ranked keywords. Live DataForSEO credentials will replace the explicitly labeled demo keyword set." /> : (
        <>
        <section className="workspace-card content-workflow"><div><span>1</span><strong>Three drafts ready</strong><small>Built from your keyword strategy</small></div><div className={approvalQuest?.status === "complete" ? "done" : "active"}><span>2</span><strong>Review & approve</strong><small>Edit in a Surfer-style workspace</small></div><div><span>3</span><strong>Choose delivery</strong><small>CMS connection or editable Word document</small></div><div className="content-workflow-actions"><Link className="secondary-button" href="/integrations">Connect CMS</Link></div></section>
        <ArticleReviewWorkspace auditId={context.audit?.id ?? "latest"} initialDrafts={articleDrafts} questId={approvalQuest?.id} questStatus={approvalQuest?.status} />
        <section className="workspace-card">
          <div className="workspace-card-heading">
            <div><strong>Editorial calendar</strong><small>{String(providerResult.sourceLabel ?? "Saved audit data")}</small></div>
            <div className="calendar-meta">
              <span>{calendar.length} weeks · 6 months</span>
              <div className="intent-info">
                <button
                  aria-describedby="intent-definitions"
                  aria-label="Search intent"
                  className="intent-info-button"
                  type="button"
                >
                  <span aria-hidden="true">?</span>
                </button>
                <div className="intent-tooltip" id="intent-definitions" role="tooltip">
                  <strong className="intent-tooltip-title">Search intent</strong>
                  {(["awareness", "consideration", "conversion"] as const).map((key) => {
                    const def = SEARCH_INTENT_DEFINITIONS[key];
                    return (
                      <div className="intent-tooltip-item" key={key}>
                        <strong>{def.label} — {def.summary}</strong>
                        <p>{def.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
          <div className="content-table">
            <div className="content-row content-head">
              <span>Schedule</span>
              <span>Content type</span>
              <span>Title</span>
              <span>Search intent</span>
              <span>Focus keyword</span>
              <span>SEO evidence</span>
              <span>Status</span>
            </div>
            {calendar.map((item, index) => (
              <div className="content-row" key={`${item.focusKeyword}-${index}`}>
                <span data-label="Schedule"><strong>Month {item.month}</strong><small>Week {item.week}</small></span>
                <span data-label="Content type"><strong>{item.contentType}</strong></span>
                <span data-label="Title"><strong>{item.title}</strong></span>
                <span data-label="Search intent">
                  <span className={`intent-badge ${item.searchIntent}`}>{SEARCH_INTENT_DEFINITIONS[item.searchIntent].label}</span>
                  <small>{SEARCH_INTENT_DEFINITIONS[item.searchIntent].summary}</small>
                </span>
                <span data-label="Focus keyword"><strong>{item.focusKeyword}</strong></span>
                <span data-label="SEO evidence"><strong>{item.searchVolume.toLocaleString()} searches</strong><small>{item.evidence} · Difficulty {item.difficulty}</small></span>
                <span className={`status-chip ${index < 3 ? "" : "amber"}`} data-label="Status">{index < 3 && approvalQuest?.status === "complete" ? "Approved for delivery" : item.status}</span>
              </div>
            ))}
          </div>
        </section>
        </>
      )}
    </WorkspaceShell>
  );
}
