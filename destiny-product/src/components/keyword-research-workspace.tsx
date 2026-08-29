"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { KeywordResearchResult, KeywordResearchRow, KeywordSerpSnapshot, SearchIntent } from "@/lib/seo/research";
import { KeywordSavePanel, KeywordSerpDrawer, KeywordSerpInsights, type KeywordListOption } from "./keyword-serp-insights";
import { INITIAL_KEYWORD_VISIBLE_LIMIT, keywordDisclosureState } from "../lib/seo/keyword-disclosure";
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

type KeywordResearchWorkspaceProps = {
  initialQuery?: string;
  websiteId?: string;
  auditId?: string;
  initialLists?: KeywordListOption[];
  initialSavedKeywords?: Array<{ keyword: string; listId: string | null }>;
};

const SERP_SESSION_LIMIT = 25;

export function KeywordResearchWorkspace({ initialQuery = "", websiteId = "", auditId = "", initialLists = [], initialSavedKeywords = [] }: KeywordResearchWorkspaceProps) {
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
  const [strategized, setStrategized] = useState<Set<string>>(() => new Set());
  const [savingStrategy, setSavingStrategy] = useState("");
  const [lists, setLists] = useState(initialLists);
  const [saved, setSaved] = useState<Map<string, string | null>>(() => new Map(initialSavedKeywords.map((item) => [item.keyword, item.listId])));
  const [saveSelection, setSaveSelection] = useState<string[]>([]);
  const [savingKeywords, setSavingKeywords] = useState(false);
  const [activeSerpKeyword, setActiveSerpKeyword] = useState("");
  const [serpSnapshots, setSerpSnapshots] = useState<Record<string, KeywordSerpSnapshot>>({});
  const [serpLoading, setSerpLoading] = useState(false);
  const [serpError, setSerpError] = useState("");
  const [revealed, setRevealed] = useState(false);
  const serpFetchCountRef = useRef(0);
  const shouldFocusFirstRevealedRef = useRef(false);
  const firstRevealedKeywordRef = useRef<HTMLTableCellElement | null>(null);

  const rows = useMemo(() => sortKeywordRows((result?.rows ?? [])
    .filter((row) => !search || row.keyword.toLowerCase().includes(search.toLowerCase()))
    .filter((row) => intent === "all" || row.intent === intent), sort), [intent, result, search, sort]);
  const disclosure = keywordDisclosureState({
    filteredCount: rows.length,
    loadedCount: result?.rows.length ?? 0,
    revealed,
  });
  const visibleRows = rows.slice(0, disclosure.visibleCount);
  const savedLabels = useMemo(() => Object.fromEntries([...saved.entries()].map(([keyword, listId]) => {
    const listName = listId ? lists.find((list) => list.id === listId)?.name ?? "Saved list" : "General";
    return [keyword, listName];
  })), [lists, saved]);

  useEffect(() => {
    if (!revealed || !shouldFocusFirstRevealedRef.current) return;
    firstRevealedKeywordRef.current?.focus();
    shouldFocusFirstRevealedRef.current = false;
  }, [revealed, visibleRows.length]);

  function updateSort(key: KeywordSortKey) {
    setSort((current) => nextKeywordSort(current, key));
  }

  function updateSearch(value: string) {
    shouldFocusFirstRevealedRef.current = false;
    setSearch(value);
    setRevealed(false);
  }

  function updateIntent(value: SearchIntent | "all") {
    shouldFocusFirstRevealedRef.current = false;
    setIntent(value);
    setRevealed(false);
  }

  function revealKeywords() {
    shouldFocusFirstRevealedRef.current = true;
    setRevealed(true);
  }

  const intentCounts = useMemo(() => (result?.rows ?? []).reduce<Record<string, number>>((counts, row) => ({ ...counts, [row.intent]: (counts[row.intent] ?? 0) + 1 }), {}), [result]);

  async function requestResearch(nextQuery: string, nextMode: "keyword" | "domain") {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/research/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: nextQuery, mode: nextMode, locationName: "United States" }),
      });
      const payload = await response.json() as KeywordResearchResult & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Keyword research failed.");
      shouldFocusFirstRevealedRef.current = false;
      setRevealed(false);
      setResult(payload);
      setQuery(nextQuery);
      setMode(nextMode);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Keyword research failed.");
    } finally {
      setLoading(false);
    }
  }

  async function run(event: FormEvent) {
    event.preventDefault();
    await requestResearch(query, mode);
  }

  async function openSerp(value: string, retry = false) {
    const cacheKey = value.trim().toLocaleLowerCase("en-US");
    setActiveSerpKeyword(value);
    setSerpError("");
    if (!retry && serpSnapshots[cacheKey]) return;
    if (serpFetchCountRef.current >= SERP_SESSION_LIMIT) {
      setSerpError("You’ve viewed 25 live first-page snapshots this session. Refresh the page to begin a new research session.");
      return;
    }
    setSerpLoading(true);
    serpFetchCountRef.current += 1;
    try {
      const response = await fetch("/api/research/keyword-serp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ websiteId, keyword: value, locationName: "United States" }) });
      const payload = await response.json() as KeywordSerpSnapshot & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Rebound SEO could not load live first-page results.");
      setSerpSnapshots((current) => ({ ...current, [cacheKey]: payload }));
    } catch (cause) {
      setSerpError(cause instanceof Error ? cause.message : "Rebound SEO could not load live first-page results.");
    } finally {
      setSerpLoading(false);
    }
  }

  async function createList(name: string) {
    if (!websiteId || !name.trim()) return null;
    setError("");
    const response = await fetch("/api/rank-tracker/lists", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ websiteId, name }) });
    const payload = await response.json() as { list?: KeywordListOption; error?: string };
    if (!response.ok || !payload.list) { setError(payload.error || "Rebound SEO could not create this list."); return null; }
    setLists((current) => [...current, payload.list as KeywordListOption]);
    return payload.list;
  }

  async function saveKeywords(listId: string | null, track: boolean) {
    if (!websiteId || !saveSelection.length) return;
    setSavingKeywords(true);
    setError("");
    try {
      await Promise.all(saveSelection.map(async (keyword) => {
        const response = await fetch("/api/rank-tracker/keywords", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ websiteId, keyword, listId, source: "research", track }) });
        const payload = await response.json() as { error?: string };
        if (!response.ok) throw new Error(payload.error || `Rebound SEO could not save ${keyword}.`);
      }));
      setSaved((current) => {
        const next = new Map(current);
        saveSelection.forEach((keyword) => next.set(keyword, listId));
        return next;
      });
      if (track) setTracked((current) => new Set([...current, ...saveSelection]));
      setSaveSelection([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Rebound SEO could not save these keywords.");
    } finally {
      setSavingKeywords(false);
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
      if (!response.ok) throw new Error(payload.error || "Rebound SEO could not start tracking this keyword.");
      setTracked((current) => new Set([...current, value]));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Rebound SEO could not start tracking this keyword.");
    } finally {
      setTracking("");
    }
  }

  async function addToStrategy(row: KeywordResearchRow) {
    if (!auditId || strategized.has(row.keyword)) return;
    setSavingStrategy(row.keyword);
    setError("");
    try {
      const response = await fetch("/api/keywords/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auditId,
          keyword: row.keyword,
          decision: "approved",
          evidence: { intent: row.intent, volume: row.volume, difficulty: row.difficulty },
        }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Rebound SEO could not add this keyword to the strategy.");
      setStrategized((current) => new Set([...current, row.keyword]));
      setTracked((current) => new Set([...current, row.keyword]));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Rebound SEO could not add this keyword to the strategy.");
    } finally {
      setSavingStrategy("");
    }
  }

  return <div className="research-workspace" id="keyword-research-workspace">
    <section className="research-search-panel">
      <div>
        <span className="research-kicker">Rebound SEO Research Lab</span>
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

    {!result ? <section className="research-empty-state"><span>⌕</span><h3>Run your first research report</h3><p>Rebound SEO will organize live provider data into demand, intent, difficulty, ranking, and traffic signals.</p></section> : <>
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
      {result.mode === "keyword" ? <KeywordSerpInsights
        available={result.serpEvidenceStatus === "live"}
        checkedAt={result.serpCheckedAt}
        onResearch={(keyword) => void requestResearch(keyword, "keyword")}
        onSave={(keyword) => setSaveSelection([keyword])}
        questions={result.questions ?? []}
        related={result.related ?? []}
        sampleKeyword={result.query}
        savedLabels={savedLabels}
      /> : null}
      <section className="research-overview-grid">
        <article className="research-card"><div className="research-card-heading"><strong>Search intent</strong><span>Why people search</span></div><div className="intent-distribution">{(["transactional", "commercial", "informational", "navigational", "unknown"] as SearchIntent[]).map((item) => <button key={item} onClick={() => updateIntent(item)} type="button"><span className={`intent-chip ${item}`}>{item}</span><strong>{intentCounts[item] ?? 0}</strong></button>)}</div></article>
        <article className="research-card research-guidance"><div className="research-card-heading"><strong>How to use this report</strong><span>Rebound SEO guidance</span></div><ol><li>Start with transactional and commercial searches tied to a service or sale.</li><li>Confirm there is credible volume and a difficulty you can compete for.</li><li>Move approved opportunities into Keyword strategy for the three-month plan.</li></ol></article>
      </section>
      {saveSelection.length ? <KeywordSavePanel keywords={saveSelection} lists={lists} onCancel={() => setSaveSelection([])} onCreateList={createList} onSave={saveKeywords} saving={savingKeywords} /> : null}
      <section className="research-card research-table-card">
        <div className="research-toolbar">
          <div><strong>Keyword ideas</strong><span aria-live="polite">{disclosure.toolbarLabel}</span></div>
          <input aria-label="Filter keywords" onChange={(event) => updateSearch(event.target.value)} placeholder="Filter keywords" value={search} />
          <select aria-label="Filter by intent" onChange={(event) => updateIntent(event.target.value as SearchIntent | "all")} value={intent}><option value="all">All intent</option><option value="transactional">Transactional</option><option value="commercial">Commercial</option><option value="informational">Informational</option><option value="navigational">Navigational</option><option value="unknown">Unknown</option></select>
        </div>
        <div className="research-table-scroll"><table className="research-table"><thead><tr>
          <SortHeader label="Keyword" onSort={updateSort} sort={sort} sortKey="keyword" /><SortHeader label="Intent" onSort={updateSort} sort={sort} sortKey="intent" /><SortHeader label="Volume" onSort={updateSort} sort={sort} sortKey="volume" /><th>Trend</th><SortHeader label="KD" onSort={updateSort} sort={sort} sortKey="difficulty" /><SortHeader label="CPC" onSort={updateSort} sort={sort} sortKey="cpc" /><SortHeader label="Competition" onSort={updateSort} sort={sort} sortKey="competition" />{result.mode === "domain" ? <><SortHeader label="Position" onSort={updateSort} sort={sort} sortKey="position" /><th>Ranking page</th></> : null}<th>First page</th><th>Save</th>{auditId ? <th>Strategy</th> : null}<th>Rank tracker</th>
        </tr></thead><tbody>{visibleRows.map((row, index) => <tr key={`${row.keyword}-${row.url}-${index}`}>
          <td ref={index === INITIAL_KEYWORD_VISIBLE_LIMIT ? firstRevealedKeywordRef : undefined} tabIndex={index === INITIAL_KEYWORD_VISIBLE_LIMIT ? -1 : undefined}><strong>{row.keyword}</strong></td><td><span className={`intent-chip ${row.intent}`}>{row.intent}</span></td><td>{row.volume.toLocaleString()}</td><td><Trend values={row.trend} /></td><td><span className={`difficulty-chip ${row.difficulty >= 70 ? "hard" : row.difficulty >= 40 ? "medium" : "easy"}`}>{row.difficulty || "—"}</span></td><td>{row.cpc ? moneyFormat.format(row.cpc) : "—"}</td><td>{row.competition ? `${Math.round(row.competition * 100)}%` : "—"}</td>{result.mode === "domain" ? <><td>{row.position || "—"}</td><td>{row.url ? <a href={row.url} rel="noreferrer" target="_blank">{rankingPageLabel(row.url)} ↗</a> : "—"}</td></> : null}
          <td>{result.serpEvidenceStatus === "live"
            ? <button className="research-row-action" onClick={() => void openSerp(row.keyword)} type="button">View first page</button>
            : <button className="research-row-action" disabled type="button">First-page preview (sample)</button>}</td>
          <td><button className={`research-row-action ${saved.has(row.keyword) ? "saved" : ""}`} disabled={!websiteId || saved.has(row.keyword)} onClick={() => setSaveSelection([row.keyword])} type="button">{saved.has(row.keyword) ? `Saved to ${savedLabels[row.keyword]} ✓` : "Save"}</button></td>
          {auditId ? <td><button className={`track-keyword-button ${strategized.has(row.keyword) ? "tracked" : ""}`} disabled={savingStrategy === row.keyword || strategized.has(row.keyword)} onClick={() => void addToStrategy(row)} type="button">{strategized.has(row.keyword) ? "In strategy ✓" : savingStrategy === row.keyword ? "Adding…" : "Add to strategy"}</button></td> : null}<td><button className={`track-keyword-button ${tracked.has(row.keyword) ? "tracked" : ""}`} disabled={!websiteId || tracking === row.keyword || tracked.has(row.keyword)} onClick={() => void trackKeyword(row.keyword)} type="button">{tracked.has(row.keyword) ? "Tracking ✓" : tracking === row.keyword ? "Adding…" : "Track"}</button></td>
        </tr>)}</tbody></table></div>
        {disclosure.buttonLabel ? <div className="research-more-keywords"><button onClick={revealKeywords} type="button">{disclosure.buttonLabel}</button><small>{disclosure.caption}</small></div> : null}
        {!rows.length ? <p className="research-no-rows">No keywords match these filters.</p> : null}
      </section>
      {activeSerpKeyword ? <KeywordSerpDrawer error={serpError} keyword={activeSerpKeyword} loading={serpLoading} onClose={() => { setActiveSerpKeyword(""); setSerpError(""); }} onRetry={() => void openSerp(activeSerpKeyword, true)} onSave={(keyword) => setSaveSelection([keyword])} savedLabels={savedLabels} snapshot={serpSnapshots[activeSerpKeyword.trim().toLocaleLowerCase("en-US")]} /> : null}
      <aside className="research-notices">{result.notices.map((notice) => <p key={notice}>ⓘ {notice}</p>)}</aside>
    </>}
  </div>;
}
