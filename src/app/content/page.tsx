import { WorkspaceEmpty } from "@/components/workspace-empty";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getWorkspaceContext, list, providerResultFromMetrics, record } from "@/lib/workspace-context";

export default async function ContentPage() {
  const context = await getWorkspaceContext();
  const providerResult = providerResultFromMetrics(context.metrics);
  const keywords = list(providerResult.keywords).map(record).filter((item) => typeof item.keyword === "string");

  return (
    <WorkspaceShell active="/content" eyebrow={context.website?.normalized_domain ?? "Destiny workspace"} title="Content strategy" description="A six-month editorial calendar built from the ranked keywords saved with your latest audit.">
      {!keywords.length ? <WorkspaceEmpty title="Keyword strategy is not ready" description="Run an audit to populate ranked keywords. Live DataForSEO credentials will replace the explicitly labeled demo keyword set." /> : (
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
                  <span className={`status-chip ${index < 4 ? "" : "amber"}`}>{index < 4 ? "Brief ready" : "Planned"}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </WorkspaceShell>
  );
}
