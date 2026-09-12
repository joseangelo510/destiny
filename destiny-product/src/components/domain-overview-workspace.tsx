"use client";

import { FormEvent, useRef, useState } from "react";
import { DOMAIN_MARKETS, type DomainOverview, type Market } from "../../supabase/functions/seo-research/domain-overview";
import { CountryTable, DomainSummary, HistoryPanel, ResearchTables } from "./domain-overview-panels";
import styles from "./domain-overview.module.css";

const tabs = ["Overview", "Growth report", "Compare by countries"] as const;
function exportReport(report: DomainOverview) {
  const lines: unknown[][] = [["Domain Overview", report.target], ["Country", report.marketLabel], ["Language", report.language], ["Source", report.source], ["Retrieved at", report.retrievedAt], ["Metric", "Value"]];
  Object.entries(report.summary).forEach(([key,value]) => lines.push([key,value ?? "Unavailable"]));
  for (const key of ["history", "countries", "keywords", "paidKeywords", "pages", "competitors", "links", "anchors", "referring"] as const) {
    const items = report[key];
    lines.push([], [key]);
    if (items.length) {
      const keys = Object.keys(items[0]).filter(name => name !== "positions"); lines.push(keys);
      for (const item of items) lines.push(keys.map(name => (item as Record<string,unknown>)[name] ?? "Unavailable"));
    }
  }
  lines.push([], ["AI mentions", report.ai.mentions ?? "Unavailable"], ["Platform", "Mentions", "AI search volume"], ...report.ai.platforms.map(item => [item.platform, item.mentions ?? "Unavailable", item.searchVolume ?? "Unavailable"]), [], ["AI source", "Mentions"], ...report.ai.sources.map(item => [item.domain, item.mentions ?? "Unavailable"]));
  lines.push([], ["Availability"], ...Object.entries(report.sections).map(([key,value]) => [key,value.state]), [], ...report.notices.map(notice => [notice]));
  const csv = lines.map(line => line.map(value => { const safe = String(value ?? "").replace(/^[=+@\t\r\n-]/, "'$&"); return `"${safe.replaceAll('"','""')}"`; }).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = `rebound-${report.target}-${report.market}.csv`; link.click(); URL.revokeObjectURL(url);
}

export function DomainOverviewWorkspace({ initialTarget, websiteId }: { initialTarget: string; websiteId: string }) {
  const [target, setTarget] = useState(initialTarget), [market,setMarket] = useState<Market>("US");
  const [report,setReport] = useState<DomainOverview | null>(null), [busy,setBusy] = useState(false), [error,setError] = useState("");
  const [tab,setTab] = useState<typeof tabs[number]>("Overview");
  const requestId = useRef(0);
  async function analyze(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(""); const id = ++requestId.current;
    try {
      const response = await fetch("/api/research/domain-overview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target, market, websiteId }), signal: AbortSignal.timeout(65_000) });
      const data = await response.json();
      if (!response.ok || !data.summary || !data.sections) throw new Error(data.error || "The report could not be loaded.");
      if (id === requestId.current) { setReport(data); setTab("Overview"); }
    } catch (cause) { setError(cause instanceof Error && cause.name !== "TimeoutError" ? cause.message : "The lookup took too long. Please try again."); }
    finally { if (id === requestId.current) setBusy(false); }
  }
  return <div className={styles.workspace}>
    <form className={styles.search} onSubmit={analyze} aria-label="Domain lookup">
      <label>Website domain<input type="text" value={target} onChange={event => setTarget(event.target.value)} placeholder="Enter a domain, e.g. example.com" maxLength={300} required disabled={busy} autoCapitalize="none" spellCheck={false} /></label>
      <label>Search market<select value={market} onChange={event => setMarket(event.target.value as Market)} disabled={busy}>{Object.entries(DOMAIN_MARKETS).map(([key,value]) => <option key={key} value={key}>{value.label}</option>)}</select></label>
      <button className={styles.primary} disabled={busy} type="submit">{busy ? "Analyzing…" : "Analyze domain"}</button>
    </form>
    <div role="status" aria-live="polite" className={styles.status}>{busy ? "Gathering search, backlink and AI evidence. This can take up to a minute." : report ? `Report for ${report.target} · ${report.marketLabel} · ${report.language.toUpperCase()} · ${report.status === "partial" ? "Some sources unavailable" : report.status === "unavailable" ? "Sources unavailable" : "Lookup complete"}` : "Research any public website. Your selected workspace stays unchanged."}</div>
    {error && <p role="alert" className={styles.notice}>{error}{report && ` The previous report for ${report.target} remains below.`}</p>}
    {!report && <section className={styles.empty}><span className={styles.kicker}>THE WHOLE PICTURE</span><h2>Every domain has a story.</h2><p>See where its traffic comes from, which keywords bring people in, and who links to it. Start with your website or explore a competitor.</p><div className={styles.emptyMetrics}><span>Search performance</span><span>Backlink profile</span><span>AI mentions</span></div></section>}
    {report && <div aria-busy={busy}>
      <header className={styles.reportHeader}><div><span className={styles.kicker}>DOMAIN OVERVIEW</span><h2>{report.target}</h2><p>Google · {report.marketLabel} · {report.language.toUpperCase()} · Retrieved {new Date(report.retrievedAt).toLocaleString()}</p></div><div className={styles.exports}><button onClick={() => exportReport(report)}>Export CSV</button><button onClick={() => window.print()}>Print view / PDF</button></div></header>
      <div className={styles.tabs} role="tablist" aria-label="Domain report views">{tabs.map(name => <button role="tab" aria-selected={tab === name} aria-controls="domain-report-panel" id={`domain-tab-${name.replaceAll(" ","-")}`} key={name} onClick={() => setTab(name)}>{name}</button>)}</div>
      <div role="tabpanel" id="domain-report-panel" aria-labelledby={`domain-tab-${tab.replaceAll(" ","-")}`}>
        <DomainSummary report={report} />
        {tab === "Compare by countries" ? <CountryTable report={report} full /> : <><div className={styles.chartGrid}><CountryTable report={report} /><HistoryPanel report={report} growth={tab === "Growth report"} /></div>{tab === "Overview" && <ResearchTables report={report} />}</>}
      </div>
      <details className={styles.method}><summary>Sources, coverage and metric definitions</summary>{report.notices.map(notice => <p key={notice}>{notice}</p>)}<p>Only platforms returned by DataForSEO appear in AI coverage. An absent platform is not a zero. SEMrush figures will differ because the providers use different indexes and methods.</p><ul>{Object.entries(report.sections).map(([key,value]) => <li key={key}>{key}: {value.state}{value.total !== null ? ` · ${value.total.toLocaleString()} total records` : ""}</li>)}</ul></details>
    </div>}
  </div>;
}
