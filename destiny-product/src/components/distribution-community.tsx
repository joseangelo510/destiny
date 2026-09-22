import { CompetitorAuditRefresh } from "@/components/rebound-core/competitor-audit-refresh";
import { buildDistributionView } from "@/lib/rebound-core/core-pages";

export function DistributionCommunity({ opportunities, websiteId }: { opportunities: Record<string, unknown>[]; websiteId: string }) {
  const { rows } = buildDistributionView({ opportunities, interlinks: [] });
  return <div className="workspace-card distribution-section">
    <div className="distribution-section-heading"><div><span className="eyebrow">1 · Community forums</span><h2>Reply to three useful Reddit or Quora threads</h2><p>Help first. Add a link only when it genuinely answers the question.</p></div><strong>Goal: 3 replies</strong></div>
    <div className="configuration-note"><strong>Refresh conversation evidence</strong><p>These are saved audit results. Run a fresh audit to check for current conversations. Opening this page does not reverify a thread. Results change only after an audit completes; a failed audit leaves the saved evidence below unchanged.</p><CompetitorAuditRefresh websiteId={websiteId} /></div>
    <div className="opportunity-grid compact">{rows.slice(0, 6).map((row) => <article className="opportunity-item" key={row.id}>
      <span className={`status-chip${row.freshness?.stale ? " amber" : ""}`}>{row.freshness?.label}</span>
      <div className="eyebrow">Saved {row.action?.platform ?? "community"} discussion</div>
      <h3>{row.title}</h3><p>{row.detail}</p>
      {row.action ? <a className="secondary-button workspace-action" href={row.action.url} rel="noreferrer" target="_blank">Review saved thread ↗</a> : <p>Destination unavailable. Run a fresh audit to find current conversations.</p>}
    </article>)}</div>
    {!rows.length && <p className="empty-state">No saved conversations are available. Run a fresh audit to look for relevant threads.</p>}
  </div>;
}
