"use client";

import { useEffect, useMemo, useState } from "react";
import { WorkspaceLink as Link } from "./workspace-link";

export type InterlinkRunView = {
  id: string;
  pagesChecked: number;
  inventoryCount: number;
  completedAt: string;
  scope: string;
};

export type InterlinkOpportunityView = {
  id: string;
  sourceUrl: string;
  sourceTitle: string;
  targetUrl: string;
  targetTitle: string;
  anchorText: string;
  sourceSentence: string;
  reason: string;
  priority: "high" | "medium" | "low";
  score: number;
  status: "suggested" | "approved" | "skipped" | "done_claimed" | "verified";
  verifiedAt: string | null;
  verifiedAnchor: string | null;
};

const PHASES = ["Reading your verified pages", "Matching related topics", "Checking that each link is safe"];

function path(value: string) {
  try { return new URL(value).pathname || "/"; } catch { return value; }
}

function statusLabel(status: InterlinkOpportunityView["status"]) {
  return ({ suggested: "Suggested", approved: "Ready to add", skipped: "Skipped", done_claimed: "Waiting for verification", verified: "Verified live" } as const)[status];
}

function benefitLabel(item: InterlinkOpportunityView) {
  const rank = item.reason.match(/ranking\s+#(\d+)/i)?.[1];
  if (rank) return `Helps “${item.targetTitle}” — currently ranking #${rank} — move toward page one.`;
  return `Helps more readers reach “${item.targetTitle}.”`;
}

export function InterlinkWorkspace({ websiteId, websiteName, initialRun, initialOpportunities }: {
  websiteId: string;
  websiteName: string;
  initialRun: InterlinkRunView | null;
  initialOpportunities: InterlinkOpportunityView[];
}) {
  const [run, setRun] = useState(initialRun);
  const [opportunities, setOpportunities] = useState(initialOpportunities);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState(0);
  const [working, setWorking] = useState("");
  const [expanded, setExpanded] = useState("");
  const [copyStatus, setCopyStatus] = useState<{ id: string; tone: "success" | "error"; message: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setPhase((current) => Math.min(PHASES.length - 1, current + 1)), 1600);
    return () => window.clearInterval(timer);
  }, [running]);

  const visible = opportunities.filter((item) => item.status !== "skipped");
  const summary = useMemo(() => ({
    found: visible.length,
    ready: visible.filter((item) => item.status === "approved" || item.status === "done_claimed").length,
    verified: visible.filter((item) => item.status === "verified").length,
  }), [visible]);

  const runAudit = async () => {
    setRunning(true); setPhase(0); setError("");
    try {
      const response = await fetch("/api/interlinks/runs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ websiteId }) });
      const payload = await response.json() as { error?: string; run?: InterlinkRunView; opportunities?: InterlinkOpportunityView[] };
      if (!response.ok || !payload.run || !payload.opportunities) throw new Error(payload.error || "Destiny could not check internal links.");
      setRun(payload.run); setOpportunities(payload.opportunities); setExpanded("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Destiny could not check internal links."); }
    finally { setRunning(false); }
  };

  const changeStatus = async (item: InterlinkOpportunityView, action: "approve" | "skip" | "mark_done") => {
    setWorking(item.id); setError("");
    try {
      const response = await fetch(`/api/interlinks/opportunities/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const payload = await response.json() as { error?: string; status?: InterlinkOpportunityView["status"] };
      if (!response.ok || !payload.status) throw new Error(payload.error || "Destiny could not save this decision.");
      setOpportunities((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, status: payload.status! } : candidate));
      if (action === "skip") setExpanded("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Destiny could not save this decision."); }
    finally { setWorking(""); }
  };

  const verify = async (item: InterlinkOpportunityView) => {
    setWorking(item.id); setError("");
    try {
      const response = await fetch(`/api/interlinks/opportunities/${item.id}/verify`, { method: "POST" });
      const payload = await response.json() as { error?: string; status?: InterlinkOpportunityView["status"]; verifiedAt?: string; verifiedAnchor?: string };
      if (!response.ok || payload.status !== "verified") throw new Error(payload.error || "Destiny did not find the link yet.");
      setOpportunities((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, status: "verified", verifiedAt: payload.verifiedAt ?? null, verifiedAnchor: payload.verifiedAnchor ?? null } : candidate));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Destiny could not verify the link."); }
    finally { setWorking(""); }
  };

  const copyEdit = async (item: InterlinkOpportunityView) => {
    try {
      await navigator.clipboard.writeText(`On “${item.sourceTitle}” (${item.sourceUrl}), find this sentence:\n\n${item.sourceSentence}\n\nTurn “${item.anchorText}” into a link to “${item.targetTitle}” (${item.targetUrl}).`);
      setCopyStatus({ id: item.id, tone: "success", message: "Edit copied." });
    } catch {
      setCopyStatus({ id: item.id, tone: "error", message: "Could not copy. Select the instructions manually." });
    }
  };

  return <div className="interlink-workspace">
    <section className="interlink-intro">
      <div><span className="eyebrow">Internal-link audit</span><h2>Connect the pages that already belong together.</h2><p>Destiny checks verified pages for a phrase that already exists, then shows the exact safe link to add. It never invents a page or marks work verified without seeing the live link.</p></div>
      <button className="primary-button" disabled={running} onClick={() => void runAudit()} type="button">{running ? "Checking pages…" : run ? "Check again" : "Find internal links"}</button>
    </section>

    {running && <section aria-live="polite" className="interlink-progress"><div className="interlink-progress-map">{PHASES.map((label, index) => <div className={index < phase ? "done" : index === phase ? "active" : ""} key={label}><span>{index < phase ? "✓" : index + 1}</span><strong>{label}</strong></div>)}</div><div aria-label={`Internal-link audit step ${phase + 1} of ${PHASES.length}`} className="interlink-progress-bar" role="progressbar" aria-valuemin={1} aria-valuemax={PHASES.length} aria-valuenow={phase + 1}><span style={{ width: `${((phase + 1) / PHASES.length) * 100}%` }} /></div></section>}
    {error && <div className="integration-banner warning" role="alert"><strong>Destiny needs your attention</strong><p>{error}</p></div>}

    {run && !running && <>
      <section className="interlink-summary" aria-label="Internal-link audit summary">
        <article><strong>{run.pagesChecked}</strong><span>verified pages checked</span></article>
        <article><strong>{summary.found}</strong><span>safe opportunities</span></article>
        <article><strong>{summary.ready}</strong><span>ready or waiting</span></article>
        <article><strong>{summary.verified}</strong><span>verified live</span></article>
        <p>Last checked {new Date(run.completedAt).toLocaleString()}. This bounded scan covered Destiny’s verified priority pages—not every URL on the website.</p>
      </section>

      {!visible.length ? <section className="workspace-card interlink-empty"><span>✓</span><div><h2>No safe opportunities found in the pages checked</h2><p>Destiny will not pad the list. Publish more content or run a fresh website audit, then check again.</p><Link className="secondary-button" href="/audits">Review website audit</Link></div></section> : <section className="interlink-results">
        <div className="interlink-results-heading"><div><span className="eyebrow">Recommended edits</span><h2>Start with the clearest opportunity.</h2></div><span>{visible.length} total</span></div>
        {visible.map((item, index) => {
          const isOpen = expanded === item.id;
          return <article className={`interlink-card ${item.status}`} key={item.id}>
            <div className="interlink-card-order"><span>{item.status === "verified" ? "✓" : index + 1}</span><small>{item.priority} priority</small></div>
            <div className="interlink-card-main">
              <div className="interlink-card-status"><span>{statusLabel(item.status)}</span>{item.verifiedAt && <small>Verified {new Date(item.verifiedAt).toLocaleDateString()}</small>}</div>
              <div className="interlink-route">
                <div className="interlink-route-source"><small><span aria-hidden="true">✎</span>Add a link on this page</small><strong>{item.sourceTitle}</strong><code>{path(item.sourceUrl)}</code></div>
                <div className="interlink-route-target"><small><span aria-hidden="true">↳</span>Pointing to this page</small><strong>{item.targetTitle}</strong><code>{path(item.targetUrl)}</code></div>
              </div>
              <p>{benefitLabel(item)}</p>
              {isOpen && <div className="interlink-edit-panel">
                <div className="interlink-edit-location"><span>Add a link on:</span><strong>{item.sourceTitle}</strong><code>{path(item.sourceUrl)}</code></div>
                <span className="eyebrow">The exact sentence to update</span>
                <blockquote>{item.sourceSentence}</blockquote>
                <div className="interlink-edit-destination"><span>Turn <strong>“{item.anchorText}”</strong> into a link.</span><span>This link points to:</span><strong>{item.targetTitle}</strong><code>{item.targetUrl}</code></div>
                <div className="interlink-edit-actions"><button className="secondary-button" onClick={() => void copyEdit(item)} type="button">{copyStatus?.id === item.id && copyStatus.tone === "success" ? "Copied" : "Copy the edit"}</button>{item.status === "suggested" && <button className="primary-button" disabled={working === item.id} onClick={() => void changeStatus(item, "approve")} type="button">Approve this edit</button>}{item.status === "approved" && <button className="primary-button" disabled={working === item.id} onClick={() => void changeStatus(item, "mark_done")} type="button">I added the link</button>}{item.status === "done_claimed" && <button className="primary-button" disabled={working === item.id} onClick={() => void verify(item)} type="button">Verify live page</button>}</div>
                {copyStatus?.id === item.id && <p aria-live="polite" className={`interlink-copy-feedback ${copyStatus.tone}`}>{copyStatus.message}</p>}
                <p className="interlink-truth-note">Nothing is changed automatically. “Verified” appears only after Destiny finds the link on the live source page.</p>
              </div>}
            </div>
            <div className="interlink-card-actions">{item.status !== "verified" && <button className="primary-button" onClick={() => { setExpanded(isOpen ? "" : item.id); setCopyStatus(null); }} type="button">{isOpen ? "Close edit" : item.status === "done_claimed" ? "Verify link" : "See the edit"}</button>}{item.status === "suggested" && <button className="link-button" disabled={working === item.id} onClick={() => void changeStatus(item, "skip")} type="button">Skip</button>}{item.status === "verified" && <span className="interlink-verified">Live link confirmed</span>}</div>
          </article>;
        })}
      </section>}
    </>}

    {!run && !running && <section className="workspace-card interlink-empty"><span>↗</span><div><h2>Find safe links in the pages Destiny already knows</h2><p>Run the check to compare your latest audit pages, ranking URLs, and published Destiny articles for this website.</p><small>{websiteName} · A complete website audit is required.</small></div></section>}
  </div>;
}
