"use client";

import { FormEvent, useMemo, useState } from "react";
import type { BacklinkResearchResult, BacklinkResearchRow } from "@/lib/seo/research";

const numberFormat = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

function exportBacklinks(rows: BacklinkResearchRow[]) {
  const csv = [["Referring page", "Referring domain", "Domain rank", "Anchor", "Target", "Attribute", "First seen", "Last seen", "Status"], ...rows.map((row) => [row.sourceUrl, row.sourceDomain, row.domainRank, row.anchor, row.targetUrl, row.dofollow ? "Follow" : "Nofollow", row.firstSeen, row.lastSeen, row.status])]
    .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  link.download = "destiny-backlinks.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}

function Distribution({ items }: { items: Array<{ label: string; value: number }> }) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return <div className="research-distribution">{items.map((item) => <div key={item.label}><span><b>{item.label}</b><small>{item.value.toLocaleString()}</small></span><i><b style={{ width: `${item.value / max * 100}%` }} /></i></div>)}</div>;
}

export function BacklinkAnalyticsWorkspace({ initialTarget = "" }: { initialTarget?: string }) {
  const [target, setTarget] = useState(initialTarget);
  const [result, setResult] = useState<BacklinkResearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [attribute, setAttribute] = useState<"all" | "follow" | "nofollow">("all");
  const [status, setStatus] = useState<"all" | "live" | "lost">("all");
  const [search, setSearch] = useState("");
  const rows = useMemo(() => (result?.rows ?? []).filter((row) => attribute === "all" || (attribute === "follow" ? row.dofollow : !row.dofollow)).filter((row) => status === "all" || row.status === status).filter((row) => !search || `${row.sourceDomain} ${row.anchor} ${row.targetUrl}`.toLowerCase().includes(search.toLowerCase())), [attribute, result, search, status]);

  async function run(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/research/backlinks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target }) });
      const payload = await response.json() as BacklinkResearchResult & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Backlink research failed.");
      setResult(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Backlink research failed.");
    } finally {
      setLoading(false);
    }
  }

  return <div className="research-workspace" id="backlink-analytics-workspace">
    <section className="research-search-panel backlink-search-panel"><div><span className="research-kicker">Rebound SEO Link Intelligence</span><h2>See who is strengthening—or weakening—your authority.</h2><p>Inspect a domain’s backlink profile, referring websites, link attributes, anchors, and broken opportunities.</p></div><form onSubmit={run}><label><span>Domain</span><input aria-label="Domain" onChange={(event) => setTarget(event.target.value)} placeholder="example.com" required value={target} /></label><span className="research-location">Root domain · Include subdomains</span><button className="primary-button" disabled={loading} type="submit">{loading ? "Analyzing…" : "Analyze backlinks"}</button></form>{error ? <p className="research-error" role="alert">{error}</p> : null}</section>
    {!result ? <section className="research-empty-state"><span>↗</span><h3>Run a backlink report</h3><p>Rebound SEO will separate individual links from unique referring domains and show the strongest sources first.</p></section> : <>
      <section className="research-report-heading"><div><span className="research-kicker">Backlink overview</span><h2>{result.target}</h2><p>{result.sourceLabel} · Updated {new Date(result.updatedAt).toLocaleString()}</p></div><button className="secondary-button" onClick={() => exportBacklinks(rows)} type="button">Export CSV</button></section>
      <section className="research-metric-grid backlink-metric-grid">
        <article><span>Domain rank</span><strong>{result.summary.domainRank}</strong><small>Provider authority signal, 0–1,000</small></article>
        <article><span>Backlinks</span><strong>{numberFormat.format(result.summary.backlinks)}</strong><small>Individual incoming links</small></article>
        <article><span>Referring domains</span><strong>{numberFormat.format(result.summary.referringDomains)}</strong><small>Unique linking websites</small></article>
        <article><span>Referring pages</span><strong>{numberFormat.format(result.summary.referringPages)}</strong><small>Pages containing links</small></article>
        <article><span>Referring IPs</span><strong>{numberFormat.format(result.summary.referringIps)}</strong><small>Network diversity</small></article>
        <article><span>Broken backlinks</span><strong>{numberFormat.format(result.summary.brokenBacklinks)}</strong><small>Potential recovery work</small></article>
      </section>
      <section className="backlink-overview-grid">
        <article className="research-card"><div className="research-card-heading"><strong>Referring-domain quality</strong><span>Loaded sample by provider rank</span></div><Distribution items={result.authorityBuckets} /></article>
        <article className="research-card"><div className="research-card-heading"><strong>Link attributes</strong><span>Follow and disclosure signals</span></div><Distribution items={result.attributes.length ? result.attributes : [{ label: "Follow", value: result.rows.filter((row) => row.dofollow).length }, { label: "Nofollow", value: result.rows.filter((row) => !row.dofollow).length }]} /></article>
        <article className="research-card"><div className="research-card-heading"><strong>Link types</strong><span>How links appear</span></div><Distribution items={result.linkTypes} /></article>
        <article className="research-card"><div className="research-card-heading"><strong>Top referring domains</strong><span>From the loaded link sample</span></div><Distribution items={result.topDomains} /></article>
      </section>
      <section className="research-card research-table-card">
        <div className="research-toolbar"><div><strong>Backlinks</strong><span>{rows.length} shown · {result.totalRows.toLocaleString()} in provider index</span></div><input aria-label="Filter backlinks" onChange={(event) => setSearch(event.target.value)} placeholder="Filter domain or anchor" value={search} /><select aria-label="Filter link attribute" onChange={(event) => setAttribute(event.target.value as typeof attribute)} value={attribute}><option value="all">All attributes</option><option value="follow">Follow</option><option value="nofollow">Nofollow</option></select><select aria-label="Filter link status" onChange={(event) => setStatus(event.target.value as typeof status)} value={status}><option value="all">Live + lost</option><option value="live">Live</option><option value="lost">Lost</option></select></div>
        <div className="research-table-scroll"><table className="research-table backlink-table"><thead><tr><th>Referring page</th><th>Domain rank</th><th>Anchor and target</th><th>Attribute</th><th>First seen</th><th>Last seen</th><th>Status</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.sourceUrl}-${row.targetUrl}-${index}`}><td><a href={row.sourceUrl} rel="noreferrer" target="_blank"><strong>{row.sourceDomain}</strong><small>{row.sourceUrl}</small></a></td><td><span className="rank-orb">{row.domainRank}</span></td><td><strong>{row.anchor}</strong><small>{row.targetUrl}</small></td><td><span className={`status-chip ${row.dofollow ? "" : "amber"}`}>{row.dofollow ? "Follow" : "Nofollow"}</span></td><td>{row.firstSeen ? new Date(row.firstSeen).toLocaleDateString() : "—"}</td><td>{row.lastSeen ? new Date(row.lastSeen).toLocaleDateString() : "—"}</td><td><span className={`status-chip ${row.status === "lost" ? "amber" : ""}`}>{row.status}</span></td></tr>)}</tbody></table></div>
        {!rows.length ? <p className="research-no-rows">No backlinks match these filters.</p> : null}
      </section>
      <aside className="research-notices">{result.notices.map((notice) => <p key={notice}>ⓘ {notice}</p>)}</aside>
    </>}
  </div>;
}
