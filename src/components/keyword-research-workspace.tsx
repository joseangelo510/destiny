"use client";

import { FormEvent, useMemo, useState } from "react";
import type { KeywordResearchResult, KeywordResearchRow, SearchIntent } from "@/lib/seo/research";

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

export function KeywordResearchWorkspace({ initialQuery = "" }: { initialQuery?: string }) {
  const [mode, setMode] = useState<"keyword" | "domain">("domain");
  const [query, setQuery] = useState(initialQuery);
  const [result, setResult] = useState<KeywordResearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [intent, setIntent] = useState<SearchIntent | "all">("all");
  const [sort, setSort] = useState<"volume" | "difficulty" | "position">("volume");

  const rows = useMemo(() => (result?.rows ?? [])
    .filter((row) => !search || row.keyword.toLowerCase().includes(search.toLowerCase()))
    .filter((row) => intent === "all" || row.intent === intent)
    .sort((left, right) => sort === "difficulty" ? right.difficulty - left.difficulty : sort === "position" ? (left.position || 999) - (right.position || 999) : right.volume - left.volume), [intent, result, search, sort]);

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
      <section className="research-overview-grid">
        <article className="research-card"><div className="research-card-heading"><strong>Search intent</strong><span>Why people search</span></div><div className="intent-distribution">{(["transactional", "commercial", "informational", "navigational", "unknown"] as SearchIntent[]).map((item) => <button key={item} onClick={() => setIntent(item)} type="button"><span className={`intent-chip ${item}`}>{item}</span><strong>{intentCounts[item] ?? 0}</strong></button>)}</div></article>
        <article className="research-card research-guidance"><div className="research-card-heading"><strong>How to use this report</strong><span>Destiny guidance</span></div><ol><li>Start with transactional and commercial searches tied to a service or sale.</li><li>Confirm there is credible volume and a difficulty you can compete for.</li><li>Move approved opportunities into Keyword strategy for the three-month plan.</li></ol></article>
      </section>
      <section className="research-card research-table-card">
        <div className="research-toolbar">
          <div><strong>Keyword ideas</strong><span>{rows.length} shown of {result.rows.length} loaded</span></div>
          <input aria-label="Filter keywords" onChange={(event) => setSearch(event.target.value)} placeholder="Filter keywords" value={search} />
          <select aria-label="Filter by intent" onChange={(event) => setIntent(event.target.value as SearchIntent | "all")} value={intent}><option value="all">All intent</option><option value="transactional">Transactional</option><option value="commercial">Commercial</option><option value="informational">Informational</option><option value="navigational">Navigational</option><option value="unknown">Unknown</option></select>
          <select aria-label="Sort keywords" onChange={(event) => setSort(event.target.value as typeof sort)} value={sort}><option value="volume">Highest volume</option><option value="difficulty">Highest difficulty</option><option value="position">Best position</option></select>
        </div>
        <div className="research-table-scroll"><table className="research-table"><thead><tr><th>Keyword</th><th>Intent</th><th>Volume</th><th>Trend</th><th>KD</th><th>CPC</th><th>Competition</th>{result.mode === "domain" ? <><th>Position</th><th>Ranking page</th></> : null}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.keyword}-${row.url}-${index}`}><td><strong>{row.keyword}</strong></td><td><span className={`intent-chip ${row.intent}`}>{row.intent}</span></td><td>{row.volume.toLocaleString()}</td><td><Trend values={row.trend} /></td><td><span className={`difficulty-chip ${row.difficulty >= 70 ? "hard" : row.difficulty >= 40 ? "medium" : "easy"}`}>{row.difficulty || "—"}</span></td><td>{row.cpc ? moneyFormat.format(row.cpc) : "—"}</td><td>{row.competition ? `${Math.round(row.competition * 100)}%` : "—"}</td>{result.mode === "domain" ? <><td>{row.position || "—"}</td><td>{row.url ? <a href={row.url} rel="noreferrer" target="_blank">{rankingPageLabel(row.url)} ↗</a> : "—"}</td></> : null}</tr>)}</tbody></table></div>
        {!rows.length ? <p className="research-no-rows">No keywords match these filters.</p> : null}
      </section>
      <aside className="research-notices">{result.notices.map((notice) => <p key={notice}>ⓘ {notice}</p>)}</aside>
    </>}
  </div>;
}
