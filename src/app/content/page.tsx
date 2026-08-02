import { WorkspaceEmpty } from "@/components/workspace-empty";
import { WorkspaceShell } from "@/components/workspace-shell";
import { QuestCompletion } from "@/components/quest-completion";
import Link from "next/link";
import { buildEditorialCalendar } from "@/lib/content/editorial-calendar";
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

  return (
    <WorkspaceShell active="/content" eyebrow={context.website?.normalized_domain ?? "Destiny workspace"} title="Content strategy" description="A six-month editorial calendar built from the ranked keywords saved with your latest audit.">
      {!keywords.length ? <WorkspaceEmpty title="Keyword strategy is not ready" description="Run an audit to populate ranked keywords. Live DataForSEO credentials will replace the explicitly labeled demo keyword set." /> : (
        <>
        <section className="workspace-card content-workflow"><div><span>1</span><strong>Draft ready</strong><small>Built from an approved keyword</small></div><div className={approvalQuest?.status === "complete" ? "done" : "active"}><span>2</span><strong>Review & approve</strong><small>Human accuracy gate</small></div><div><span>3</span><strong>Send to CMS</strong><small>Connect your publishing platform</small></div><div className="content-workflow-actions">{approvalQuest && <QuestCompletion questId={approvalQuest.id} status={approvalQuest.status} xp={approvalQuest.xp} completeLabel="Approve for CMS" completedLabel="Reopen content review" />}<Link className="secondary-button" href="/integrations">Connect CMS</Link></div></section>
        <section className="workspace-card">
          <div className="workspace-card-heading"><div><strong>Editorial calendar</strong><small>{String(providerResult.sourceLabel ?? "Saved audit data")}</small></div><span>{calendar.length} weeks · 6 months</span></div>
          <div className="content-table">
            <div className="content-row content-head"><span>Schedule</span><span>Type and title</span><span>Focus keyword</span><span>SEO evidence</span><span>Status</span></div>
            {calendar.map((item, index) => {
              return (
                <div className="content-row" key={`${item.focusKeyword}-${index}`}>
                  <span><strong>Month {item.month}</strong><small>Week {item.week}</small></span>
                  <span><small>{item.type}</small><strong>{item.title}</strong></span>
                  <span><strong>{item.focusKeyword}</strong><small>{item.intent} intent</small></span>
                  <span><strong>{item.searchVolume.toLocaleString()} searches</strong><small>{item.evidence} · Difficulty {item.difficulty}</small></span>
                  <span className={`status-chip ${index < 4 ? "" : "amber"}`}>{index === 0 && approvalQuest?.status === "complete" ? "Approved for CMS" : item.status}</span>
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
