"use client";

import { FormEvent, useMemo, useState } from "react";
import type { KeywordResearchResult, KeywordResearchRow, SearchIntent } from "@/lib/seo/research";
import { nextKeywordSort, sortKeywordRows, type KeywordSort, type KeywordSortKey } from "../lib/seo/keyword-sort";

const numberFormat = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const moneyFormat = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function rankingPageLabel(value: string) {
  try {
    return new URL(value).pathname || "/";
  } catch {
    return value;
  }
}

function exportKeywords(rows: KeywordResearchRow[]) {
  const lines = [
    ["Keyword", "Intent", "Monthly volume", "Difficulty", "CPC", "Competition", "Position", "Estimated traffic", "Ranking URL"],
    ...rows.map((row) => [row.keyword, row.intent, row.volume, row.difficulty, row.cpc, row.competition, row.position || "", row.traffic || "", row.url]),
  ].map((row) => row.map(csvCell).join(","));
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }));
  link.download = "destiny-keyword-research.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}

function Trend({ values }: { values: number[] }) {
  if (!values.length) return <span className="research-muted">No trend</span>;
  const max = Math.max(...values, 1);
  return <span aria-label="Twelve month search trend" className="research-sparkline">{values.map((value, index) => <i key={index} style={{ height: `${Math.max(12, value / max * 100)}%` }} />)}</span>;
}

function SortHeader({ label, sortKey, sort, onSort }: { label: string; sortKey: KeywordSortKey; sort: KeywordSort; onSort: (key: KeywordSortKey) => void }) {
  const active = sort.key === sortKey;
  const direction = active ? sort.direction : null;
  const state = direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none";
  const meaning = sortKey === "position"
    ? direction === "asc" ? "best ranking first" : direction === "desc" ? "lowest ranking first" : "not sorted"
    : direction === "asc" ? "lowest to highest" : direction === "desc" ? "highest to lowest" : "not sorted";
  return <th aria-sort={state}>
    <button aria-label={`Sort by ${label}. Currently ${meaning}.`} className={`research-sort-button ${active ? "active" : ""}`} onClick={() => onSort(sortKey)} type="button">
      <span>{label}</span><span aria-hidden="true" className="research-sort-arrows"><i className={direction === "asc" ? "active" : ""}>↑</i><i className={direction === "desc" ? "active" : ""}>↓</i></span>
    </button>
  </th>;
}

type PerformancePoint = NonNullable<KeywordResearchResult["performance"]>[number];

function monthLabel(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
}

export function PerformanceChart({ points, metric, onMetricChange }: { points: PerformancePoint[]; metric: "traffic" | "keywords"; onMetricChange: (metric: "traffic" | "keywords") => void }) {
  const width = 760;
  const height = 230;
  const padding = { top: 24, right: 25, bottom: 35, left: 52 };
  const values = points.map((point) => point[metric]);
  const maximum = Math.max(...values, 1);
  const baseline = height - padding.bottom;
  const x = (index: number) => points.length === 1 ? width / 2 : padding.left + index * ((width - padding.left - padding.right) / Math.max(points.length - 1, 1));
  const y = (value: number) => baseline - (value / maximum) * (baseline - padding.top);
  const line = points.map((point, index) => `${x(index)},${y(point[metric])}`).join(" ");
  const area = points.length ? `${padding.left},${baseline} ${line} ${x(points.length - 1)},${baseline}` : "";
  const latest = points.at(-1);
  const first = points[0];
  const change = latest && first && first[metric] > 0 ? Math.round(((latest[metric] - first[metric]) / first[metric]) * 100) : null;

  return <section className="research-card performance-card">
    <div className="performance-heading">
      <div><span className="research-kicker">Last 90 days</span><h3>Organic performance</h3><p>Monthly estimates from the domain’s Google rankings.</p></div>
      <div className="performance-tabs" role="group" aria-label="Performance metric">
        <button className={metric === "traffic" ? "active" : ""} onClick={() => onMetricChange("traffic")} type="button">Organic traffic</button>
        <button className={metric === "keywords" ? "active" : ""} onClick={() => onMetricChange("keywords")} type="button">Ranking keywords</button>
      </div>
    </div>
    {!points.length ? <div className="performance-empty"><span>⌁</span><strong>Historical estimates are not available for this domain yet.</strong><p>The current ranking table remains live and usable.</p></div> : <>
      <div className="performance-summary">
        <div><span>{metric === "traffic" ? "Estimated monthly organic traffic" : "Keywords ranking in Google"}</span><strong>{numberFormat.format(latest?.[metric] ?? 0)}</strong></div>
        <span className={`performance-change ${(change ?? 0) < 0 ? "down" : ""}`}>{change === null ? "New history" : `${change >= 0 ? "↑" : "↓"} ${Math.abs(change)}%`} <small>over 90 days</small></span>
        <div className="performance-position-stats"><span><b>{numberFormat.format(latest?.top3 ?? 0)}</b> Top 3</span><span><b>{numberFormat.format(latest?.top10 ?? 0)}</b> Top 10</span></div>
      </div>
      <div className="performance-chart-wrap">
        <svg aria-label={`${metric === "traffic" ? "Estimated organic traffic" : "Ranking keywords"} over the last 90 days`} className="performance-chart" role="img" viewBox={`0 0 ${width} ${height}`}>
          <defs><linearGradient id="destiny-performance-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#4f9478" stopOpacity=".27" /><stop offset="100%" stopColor="#4f9478" stopOpacity=".02" /></linearGradient></defs>
          {[0, .5, 1].map((ratio) => {
            const lineY = padding.top + ratio * (baseline - padding.top);
            const label = Math.round(maximum * (1 - ratio));
            return <g key={ratio}><line className="performance-grid-line" x1={padding.left} x2={width - padding.right} y1={lineY} y2={lineY} /><text className="performance-axis-label" x={padding.left - 9} y={lineY + 4}>{numberFormat.format(label)}</text></g>;
          })}
          <polygon fill="url(#destiny-performance-area)" points={area} />
          <polyline className="performance-line" points={line} />
          {points.map((point, index) => <g className="performance-point" key={point.date}><circle cx={x(index)} cy={y(point[metric])} r="5"><title>{monthLabel(point.date)}: {point[metric].toLocaleString()} {metric === "traffic" ? "estimated visits" : "ranking keywords"}</title></circle><text className="performance-month" textAnchor="middle" x={x(index)} y={height - 10}>{monthLabel(point.date)}</text></g>)}
        </svg>
      </div>
      <p className="performance-footnote">Provider estimates—not Google Analytics sessions. Connect Analytics and Search Console for first-party performance.</p>
    </>}
  </section>;
}

export function KeywordResearchWorkspace({ initialQuery = "", websiteId = "" }: { initialQuery?: string; websiteId?: string }) {
  const [mode, setMode] = useState<"keyword" | "domain">("domain");
  const [query, setQuery] = useState(initialQuery);
  const [result, setResult] = useState<KeywordResearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [intent, setIntent] = useState<SearchIntent | "all">("all");
  const [sort, setSort] = useState<KeywordSort>({ key: "volume", direction: "desc" });
  const [performanceMetric, setPerformanceMetric] = useState<"traffic" | "keywords">("traffic");
  const [tracked, setTracked] = useState<Set<string>>(() => new Set());
  const [tracking, setTracking] = useState("");

  const rows = useMemo(() => sortKeywordRows((result?.rows ?? [])
    .filter((row) => !search || row.keyword.toLowerCase().includes(search.toLowerCase()))
    .filter((row) => intent === "all" || row.intent === intent), sort), [intent, result, search, sort]);

  function updateSort(key: KeywordSortKey) {
    setSort((current) => nextKeywordSort(current, key));
  }

  const intentCounts = useMemo(() => (result?.rows ?? []).reduce<Record<string, number>>((counts, row) => ({ ...counts, [row.intent]: (counts[row.intent] ?? 0) + 1 }), {}), [result]);

  async function run(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/research/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, mode, locationName: "United States" }),
      });
      const payload = await response.json() as KeywordResearchResult & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Keyword research failed.");
      setResult(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Keyword research failed.");
    } finally {
      setLoading(false);
    }
  }

  async function trackKeyword(value: string) {
    if (!websiteId || tracked.has(value)) return;
    setTracking(value);
    setError("");
    try {
      const response = await fetch("/api/rank-tracker/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId, keyword: value, source: "research" }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Destiny could not start tracking this keyword.");
      setTracked((current) => new Set([...current, value]));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Destiny could not start tracking this keyword.");
    } finally {
      setTracking("");
    }
  }

  return <div className="research-workspace">
    <section className="research-search-panel">
      <div>
        <span className="research-kicker">Destiny Research Lab</span>
        <h2>Explore search demand before you choose the route.</h2>
        <p>Start with a domain to inspect current rankings, or a phrase to uncover related searches and buying intent.</p>
      </div>
      <form onSubmit={run}>
        <div className="research-mode-switch" role="group" aria-label="Research mode">
          <button className={mode === "domain" ? "active" : ""} onClick={() => setMode("domain")} type="button">Domain</button>
          <button className={mode === "keyword" ? "active" : ""} onClick={() => setMode("keyword")} type="button">Keyword</button>
        </div>
        <label><span>{mode === "domain" ? "Domain" : "Keyword phrase"}</span><input aria-label={mode === "domain" ? "Domain" : "Keyword phrase"} onChange={(event) => setQuery(event.target.value)} placeholder={mode === "domain" ? "example.com" : "college admissions consultant"} required value={query} /></label>
        <span className="research-location">Google · United States · English</span>
        <button className="primary-button" disabled={loading} type="submit">{loading ? "Researching…" : "Search"}</button>
      </form>
      {error ? <p className="research-error" role="alert">{error}</p> : null}
    </section>

    {!result ? <section className="research-empty-state"><span>⌕</span><h3>Run your first research report</h3><p>Destiny will organize live provider data into demand, intent, difficulty, ranking, and traffic signals.</p></section> : <>
      <section className="research-report-heading">
        <div><span className="research-kicker">{result.mode === "domain" ? "Organic keyword overview" : "Keyword overview"}</span><h2>{result.query}</h2><p>{result.sourceLabel} · Updated {new Date(result.updatedAt).toLocaleString()}</p></div>
        <button className="secondary-button" onClick={() => exportKeywords(rows)} type="button">Export CSV</button>
      </section>
      <section className="research-metric-grid">
        <article><span>Total keywords</span><strong>{numberFormat.format(result.metrics.totalKeywords)}</strong><small>Provider index</small></article>
        <article><span>Search demand</span><strong>{numberFormat.format(result.metrics.totalVolume)}</strong><small>Monthly volume in this report</small></article>
        <article><span>Average difficulty</span><strong>{result.metrics.averageDifficulty}</strong><small>Estimated ranking competition</small></article>
        <article><span>Estimated traffic</span><strong>{numberFormat.format(result.metrics.estimatedTraffic)}</strong><small>{result.mode === "domain" ? "From current rankings" : "Available for domain reports"}</small></article>
      </section>
      {result.mode === "domain" ? <PerformanceChart metric={performanceMetric} onMetricChange={setPerformanceMetric} points={result.performance ?? []} /> : null}
      <section className="research-overview-grid">
        <article className="research-card"><div className="research-card-heading"><strong>Search intent</strong><span>Why people search</span></div><div className="intent-distribution">{(["transactional", "commercial", "informational", "navigational", "unknown"] as SearchIntent[]).map((item) => <button key={item} onClick={() => setIntent(item)} type="button"><span className={`intent-chip ${item}`}>{item}</span><strong>{intentCounts[item] ?? 0}</strong></button>)}</div></article>
        <article className="research-card research-guidance"><div className="research-card-heading"><strong>How to use this report</strong><span>Destiny guidance</span></div><ol><li>Start with transactional and commercial searches tied to a service or sale.</li><li>Confirm there is credible volume and a difficulty you can compete for.</li><li>Move approved opportunities into Keyword strategy for the three-month plan.</li></ol></article>
      </section>
      <section className="research-card research-table-card">
        <div className="research-toolbar">
          <div><strong>Keyword ideas</strong><span>{rows.length} shown of {result.rows.length} loaded</span></div>
          <input aria-label="Filter keywords" onChange={(event) => setSearch(event.target.value)} placeholder="Filter keywords" value={search} />
          <select aria-label="Filter by intent" onChange={(event) => setIntent(event.target.value as SearchIntent | "all")} value={intent}><option value="all">All intent</option><option value="transactional">Transactional</option><option value="commercial">Commercial</option><option value="informational">Informational</option><option value="navigational">Navigational</option><option value="unknown">Unknown</option></select>
        </div>
        <div className="research-table-scroll"><table className="research-table"><thead><tr><SortHeader label="Keyword" onSort={updateSort} sort={sort} sortKey="keyword" /><SortHeader label="Intent" onSort={updateSort} sort={sort} sortKey="intent" /><SortHeader label="Volume" onSort={updateSort} sort={sort} sortKey="volume" /><th>Trend</th><SortHeader label="KD" onSort={updateSort} sort={sort} sortKey="difficulty" /><SortHeader label="CPC" onSort={updateSort} sort={sort} sortKey="cpc" /><SortHeader label="Competition" onSort={updateSort} sort={sort} sortKey="competition" />{result.mode === "domain" ? <><SortHeader label="Position" onSort={updateSort} sort={sort} sortKey="position" /><th>Ranking page</th></> : null}<th>Rank tracker</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.keyword}-${row.url}-${index}`}><td><strong>{row.keyword}</strong></td><td><span className={`intent-chip ${row.intent}`}>{row.intent}</span></td><td>{row.volume.toLocaleString()}</td><td><Trend values={row.trend} /></td><td><span className={`difficulty-chip ${row.difficulty >= 70 ? "hard" : row.difficulty >= 40 ? "medium" : "easy"}`}>{row.difficulty || "—"}</span></td><td>{row.cpc ? moneyFormat.format(row.cpc) : "—"}</td><td>{row.competition ? `${Math.round(row.competition * 100)}%` : "—"}</td>{result.mode === "domain" ? <><td>{row.position || "—"}</td><td>{row.url ? <a href={row.url} rel="noreferrer" target="_blank">{rankingPageLabel(row.url)} ↗</a> : "—"}</td></> : null}<td><button className={`track-keyword-button ${tracked.has(row.keyword) ? "tracked" : ""}`} disabled={!websiteId || tracking === row.keyword || tracked.has(row.keyword)} onClick={() => void trackKeyword(row.keyword)} type="button">{tracked.has(row.keyword) ? "Tracking ✓" : tracking === row.keyword ? "Adding…" : "Track"}</button></td></tr>)}</tbody></table></div>
        {!rows.length ? <p className="research-no-rows">No keywords match these filters.</p> : null}
      </section>
      <aside className="research-notices">{result.notices.map((notice) => <p key={notice}>ⓘ {notice}</p>)}</aside>
    </>}
  </div>;
}
