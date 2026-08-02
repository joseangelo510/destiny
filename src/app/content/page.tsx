import { WorkspaceEmpty } from "@/components/workspace-empty";
import { WorkspaceShell } from "@/components/workspace-shell";
import { QuestCompletion } from "@/components/quest-completion";
import Link from "next/link";
import { getWorkspaceContext, list, providerResultFromMetrics, record } from "@/lib/workspace-context";

export default async function ContentPage() {
  const context = await getWorkspaceContext();
  const providerResult = providerResultFromMetrics(context.metrics);
  const keywords = list(providerResult.keywords).map(record).filter((item) => typeof item.keyword === "string" && item.verdict !== "reject");
  const approvalQuest = context.quests.find((quest) => quest.audit_id === context.audit?.id && quest.task_type === "content_review");

  return (
    <WorkspaceShell active="/content" eyebrow={context.website?.normalized_domain ?? "Destiny workspace"} title="Content strategy" description="A six-month editorial calendar built from the ranked keywords saved with your latest audit.">
      {!keywords.length ? <WorkspaceEmpty title="Keyword strategy is not ready" description="Run an audit to populate ranked keywords. Live DataForSEO credentials will replace the explicitly labeled demo keyword set." /> : (
        <>
        <section className="workspace-card content-workflow"><div><span>1</span><strong>Draft ready</strong><small>Built from an approved keyword</small></div><div className={approvalQuest?.status === "complete" ? "done" : "active"}><span>2</span><strong>Review & approve</strong><small>Human accuracy gate</small></div><div><span>3</span><strong>Send to CMS</strong><small>Connect your publishing platform</small></div><div className="content-workflow-actions">{approvalQuest && <QuestCompletion questId={approvalQuest.id} status={approvalQuest.status} xp={approvalQuest.xp} completeLabel="Approve for CMS" completedLabel="Reopen content review" />}<Link className="secondary-button" href="/integrations">Connect CMS</Link></div></section>
        <section className="workspace-card">
          <div className="workspace-card-heading"><div><strong>Editorial calendar</strong><small>{String(providerResult.sourceLabel ?? "Saved audit data")}</small></div><span>{keywords.length} topics</span></div>
          <div className="content-table">
            <div className="content-row content-head"><span>Schedule</span><span>Type and title</span><span>Focus keyword</span><span>SEO evidence</span><span>Status</span></div>
            {keywords.map((keyword, index) => {
              const intent = String(keyword.intent || "informational");
              const opportunity = String(keyword.opportunity || "existing_rank");
              const type = opportunity === "existing_rank"
                ? "Existing page refresh"
                : ["commercial", "transactional"].includes(intent) ? "New landing page" : "New expert guide";
              const evidence = opportunity === "competitor_gap" ? "Competitor gap" : opportunity === "site_idea" ? "Relevant site idea" : `Current rank ${Number(keyword.rank ?? 0) || "—"}`;
              return (
                <div className="content-row" key={`${String(keyword.keyword)}-${index}`}>
                  <span><strong>Month {Math.floor(index / 4) + 1}</strong><small>Week {(index % 4) + 1}</small></span>
                  <span><small>{type}</small><strong>{type === "New landing page" ? `Create the definitive page for “${String(keyword.keyword)}”` : type === "Existing page refresh" ? `Improve the page already ranking for “${String(keyword.keyword)}”` : `Answer the essential questions about “${String(keyword.keyword)}”`}</strong></span>
                  <span><strong>{String(keyword.keyword)}</strong><small>{intent} intent</small></span>
                  <span><strong>{Number(keyword.searchVolume ?? 0).toLocaleString()} searches</strong><small>{evidence} · Difficulty {Number(keyword.difficulty ?? 0)}</small></span>
                  <span className={`status-chip ${index < 4 ? "" : "amber"}`}>{index === 0 && approvalQuest?.status === "complete" ? "Approved for CMS" : index < 4 ? "Review draft" : "Planned"}</span>
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
