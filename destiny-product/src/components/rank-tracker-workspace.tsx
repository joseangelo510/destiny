"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { buildInAppRankingReport } from "../lib/notifications/in-app-ranking-report";
import { rankFreshnessFromPolicy, rankMovementFromPolicy, rankPolicyInput, rankReadingFromPolicy } from "../lib/seo/rank-tracker";
import { runDestinyLogic } from "../lib/logicaffeine";

export type RankTrackerList = { id: string; name: string };
export type RankTrackerKeyword = {
  id: string;
  keyword: string;
  listId: string | null;
  status: string;
  source: string;
  createdAt: string;
  lastCheckedAt: string | null;
  currentPosition: number | null;
  previousPosition: number | null;
  previousFound?: boolean | null;
  found: boolean | null;
  resultUrl: string | null;
  checkedAt: string | null;
  history?: Array<{ observedAt: string; position: number | null; found: boolean }>;
  policyView?: { reading: { label: string; tone: string }; movement: { label: string; tone: string }; freshness: { message: string }; bucket: number };
};

type Props = { websiteId: string; initialLists: RankTrackerList[]; initialKeywords: RankTrackerKeyword[]; rankingDigestFrequency?: "three_day" | "weekly" | "off"; reportGeneratedAt?: string };

export function RankTrackerWorkspace({ websiteId, initialLists, initialKeywords, rankingDigestFrequency = "weekly", reportGeneratedAt }: Props) {
  const [lists, setLists] = useState(initialLists);
  const [keywords, setKeywords] = useState(initialKeywords);
  const [activeList, setActiveList] = useState<string>("all");
  const [keyword, setKeyword] = useState("");
  const [listName, setListName] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    const missing = keywords.filter((row) => !row.policyView);
    if (!missing.length) return;
    void Promise.all(missing.map(async (row) => {
      const previous = row.previousFound === undefined && row.previousPosition === null ? null : { position: row.previousPosition, found: row.previousFound ?? (row.previousPosition !== null) };
      const input = rankPolicyInput({ status: row.status, position: row.currentPosition, found: row.found }, previous, { createdAt: row.createdAt, lastCheckedAt: row.lastCheckedAt, now: new Date() });
      const policy = await runDestinyLogic(input);
      return { id: row.id, policyView: { reading: rankReadingFromPolicy(policy, row.currentPosition), movement: rankMovementFromPolicy(policy), freshness: rankFreshnessFromPolicy(policy, input.rankAgeDays ?? 0), bucket: policy.rankBucket } };
    })).then((updates) => {
      if (!cancelled) setKeywords((current) => current.map((row) => updates.find((update) => update.id === row.id) ? { ...row, policyView: updates.find((update) => update.id === row.id)?.policyView } : row));
    }).catch((cause: unknown) => {
      if (cancelled) return;
      setKeywords((current) => current.map((row) => !row.policyView ? { ...row, policyView: { reading: { label: "Rules unavailable — reload", tone: "error" }, movement: { label: "—", tone: "flat" }, freshness: { message: "Destiny could not verify freshness." }, bucket: 0 } } : row));
      setError("Destiny could not load the rank-tracker rules. Reload to try again.");
      console.error("logos_rank_tracker", { fallbacks: 0, wasm_errors: 1, cause });
    });
    return () => { cancelled = true; };
  }, [keywords]);
  const summary = useMemo(() => {
    const measured = keywords.filter((row) => row.status !== "pending" && row.found !== null);
    const ranked = measured.filter((row) => row.found && row.currentPosition !== null);
    return { tracked: keywords.length, measured: measured.length, top3: measured.filter((row) => row.policyView?.bucket === 1).length, top10: measured.filter((row) => row.policyView && row.policyView.bucket > 0 && row.policyView.bucket < 3).length, averagePosition: ranked.length ? Math.round(ranked.reduce((sum, row) => sum + (row.currentPosition ?? 0), 0) / ranked.length) : null };
  }, [keywords]);
  const visible = useMemo(() => activeList === "all" ? keywords : activeList === "general" ? keywords.filter((item) => !item.listId) : keywords.filter((item) => item.listId === activeList), [activeList, keywords]);
  const planKeywordCount = keywords.filter((item) => item.source === "strategy").length;
  const watchlistCount = keywords.length - planKeywordCount;
  const reportNow = reportGeneratedAt
    ?? keywords.map((item) => item.checkedAt).filter((value): value is string => Boolean(value)).sort().at(-1)
    ?? new Date(0).toISOString();
  const weeklyReport = useMemo(() => buildInAppRankingReport(keywords.map((row) => ({
    keyword: row.keyword,
    currentPosition: row.currentPosition,
    currentFound: row.found === true,
    previousPosition: row.previousPosition,
    previousFound: row.previousFound ?? null,
    observedAt: row.checkedAt,
  })), reportNow), [keywords, reportNow]);

  async function addKeyword(event: FormEvent) {
    event.preventDefault();
    if (!keyword.trim()) return;
    setAdding(true);
    setError("");
    const response = await fetch("/api/rank-tracker/keywords", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ websiteId, keyword, listId: activeList !== "all" && activeList !== "general" ? activeList : null, source: "manual" }) });
    const payload = await response.json() as { keyword?: RankTrackerKeyword; error?: string };
    if (!response.ok || !payload.keyword) setError(payload.error || "Destiny could not add this keyword.");
    else {
      setKeywords((current) => [...current.filter((item) => item.id !== payload.keyword?.id), payload.keyword as RankTrackerKeyword]);
      setKeyword("");
    }
    setAdding(false);
  }

  async function createList(event: FormEvent) {
    event.preventDefault();
    if (!listName.trim()) return;
    setError("");
    const response = await fetch("/api/rank-tracker/lists", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ websiteId, name: listName }) });
    const payload = await response.json() as { list?: RankTrackerList; error?: string };
    if (!response.ok || !payload.list) setError(payload.error || "Destiny could not create this list.");
    else { setLists((current) => [...current, payload.list as RankTrackerList]); setActiveList(payload.list.id); setListName(""); }
  }

  async function moveKeyword(id: string, listId: string | null) {
    setError("");
    const response = await fetch("/api/rank-tracker/keywords", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, listId }) });
    const payload = await response.json() as { error?: string };
    if (!response.ok) setError(payload.error || "Destiny could not move this keyword.");
    else setKeywords((current) => current.map((item) => item.id === id ? { ...item, listId } : item));
  }

  return <div className="rank-tracker-workspace" id="rank-tracker-workspace">
    <section className="rank-tracker-intro">
      <div><span className="research-kicker">{rankingDigestFrequency === "three_day" ? "Google rank tracking every 3 days" : "Weekly Google rank tracking"}</span><h2>See whether your approved strategy is gaining ground.</h2><p>Destiny checks the same search context on your chosen schedule so movement is comparable—not guessed.</p></div>
      <div className="rank-context"><strong>Measurement context</strong><span>Google Search</span><span>United States · English · Desktop</span><small>A new keyword’s first reading usually arrives within minutes. Please allow up to 24 hours.</small></div>
    </section>

    <section className="rank-summary-grid">
      <article><span>Tracked keywords</span><strong>{summary.tracked}</strong><small>{summary.measured} measured</small></article>
      <article><span>Top 3</span><strong>{summary.top3}</strong><small>Confirmed positions</small></article>
      <article><span>Top 10</span><strong>{summary.top10}</strong><small>Confirmed positions</small></article>
      <article><span>Average position</span><strong>{summary.averagePosition ?? "—"}</strong><small>Ranked keywords only</small></article>
    </section>

    <section className="rank-weekly-report" aria-labelledby="rank-weekly-report-title">
      <header><div><span className="research-kicker">In-app weekly report</span><h2 id="rank-weekly-report-title">{weeklyReport.state === "ready" ? "What changed in your search visibility" : "Waiting for this week’s fresh readings"}</h2><p>{weeklyReport.state === "ready" ? `Built only from ${weeklyReport.summary.keywordsCompared + weeklyReport.summary.baselines.length} saved Google observations. First readings are labeled as baselines, never movement.` : "Your tracked keywords are saved. Destiny will build this report after a new provider reading arrives."}</p></div>{weeklyReport.evidenceAt ? <small>Evidence checked {new Date(weeklyReport.evidenceAt).toLocaleString()}</small> : <small>No fresh observation yet</small>}</header>
      {weeklyReport.state === "ready" ? <>
        <div className="rank-weekly-report-metrics">
          <article><strong>{weeklyReport.summary.movedUp}</strong><span>Moved up</span></article>
          <article><strong>{weeklyReport.summary.movedDown}</strong><span>Moved down</span></article>
          <article><strong>{weeklyReport.summary.enteredTop10}</strong><span>Entered top 10</span></article>
          <article><strong>{weeklyReport.summary.baselines.length}</strong><span>New baselines</span></article>
        </div>
        <div className="rank-weekly-report-details">
          <div><strong>Best current positions</strong>{weeklyReport.topRanked.length ? <ol>{weeklyReport.topRanked.slice(0, 5).map((item) => <li key={item.keyword}><span>{item.keyword}</span><b>#{item.position}</b></li>)}</ol> : <p>No ranked keyword was observed in the first 100 results this week.</p>}</div>
          <div><strong>Not visible in the first 100</strong>{weeklyReport.notVisible.length ? <ul>{weeklyReport.notVisible.slice(0, 5).map((item) => <li key={item}>{item}</li>)}</ul> : <p>Every fresh reading in this report had a confirmed position.</p>}</div>
        </div>
      </> : null}
    </section>

    <section aria-label="Keyword tracking sources" className="rank-source-summary">
      <div><strong>{planKeywordCount}</strong><span>Plan keywords</span><small>Approved in Keyword strategy</small></div>
      <div><strong>{watchlistCount}</strong><span>Watchlist</span><small>Added from research or manually</small></div>
      <p>Plan keywords measure the strategy you approved. Your watchlist lets you monitor extra searches without changing that plan.</p>
    </section>

    <section className="rank-tracker-layout">
      <aside className="rank-list-panel">
        <div><strong>Keyword lists</strong><small>Organize services, campaigns, or markets.</small></div>
        <button className={activeList === "all" ? "active" : ""} onClick={() => setActiveList("all")} type="button"><span>All keywords</span><b>{keywords.length}</b></button>
        <button className={activeList === "general" ? "active" : ""} onClick={() => setActiveList("general")} type="button"><span>General</span><b>{keywords.filter((item) => !item.listId).length}</b></button>
        {lists.map((list) => <button className={activeList === list.id ? "active" : ""} key={list.id} onClick={() => setActiveList(list.id)} type="button"><span>{list.name}</span><b>{keywords.filter((item) => item.listId === list.id).length}</b></button>)}
        <form onSubmit={createList}><input aria-label="New list name" onChange={(event) => setListName(event.target.value)} placeholder="New list name" value={listName} /><button className="secondary-button" type="submit">Create list</button></form>
      </aside>

      <div className="rank-table-panel">
        <form className="rank-add-form" onSubmit={addKeyword}><label><span>Add keywords</span><input aria-label="Keyword to track" onChange={(event) => setKeyword(event.target.value)} placeholder="Enter a keyword" value={keyword} /></label><button className="primary-button" disabled={adding} type="submit">{adding ? "Adding…" : "Track keyword"}</button></form>
        <div className="rank-table-scroll"><table className="rank-table"><thead><tr><th>Keyword</th><th>Position</th><th>Change</th><th>Trend</th><th>Ranking page</th><th>Last checked</th><th>List</th></tr></thead><tbody>{visible.map((row) => {
          const reading = row.policyView?.reading ?? { label: "Checking…", tone: "pending" };
          const movement = row.policyView?.movement ?? { label: "—", tone: "flat" };
          const freshness = row.policyView?.freshness ?? { message: "Calculating freshness…" };
          return <tr key={row.id}><td><strong>{row.keyword}</strong><small>{row.source === "strategy" ? "From Keyword strategy" : row.source === "research" ? "From Keyword research" : "Manually added"}</small></td><td><span className={`rank-state ${reading.tone}`}>{reading.label}</span></td><td><span className={`rank-movement ${movement.tone}`}>{movement.label}</span></td><td><RankTrend history={row.history ?? []} /></td><td>{row.resultUrl ? <a href={row.resultUrl} rel="noreferrer" target="_blank">View page ↗</a> : "—"}</td><td><span>{row.checkedAt ? new Date(row.checkedAt).toLocaleDateString() : "Pending"}</span><small>{freshness.message}</small></td><td><select aria-label={`List for ${row.keyword}`} onChange={(event) => void moveKeyword(row.id, event.target.value || null)} value={row.listId ?? ""}><option value="">General</option>{lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}</select></td></tr>;
        })}</tbody></table></div>
        {!visible.length ? <div className="rank-empty"><strong>No keywords in this list yet.</strong><p>Add one here, approve one in Keyword strategy, or track one from Keyword research.</p></div> : null}
      </div>
    </section>
    <aside className="rank-evidence-note"><strong>What “Not yet visible” means</strong><p>Google did not show this website in the first 100 results—about 10 pages—for that search during the latest check. It is a starting point, not a penalty, and it never means position zero.</p></aside>
    {error ? <div className="error-banner" role="alert">{error}</div> : null}
  </div>;
}

function RankTrend({ history }: { history: Array<{ observedAt: string; position: number | null; found: boolean }> }) {
  const measured = [...history].reverse().slice(-8);
  if (measured.length < 2) return <span className="rank-no-trend">Needs 2 checks</span>;
  const width = 90;
  const height = 30;
  const plotted = measured.map((item, index) => ({ x: index * (width / Math.max(measured.length - 1, 1)), y: item.found && item.position ? 2 + ((item.position - 1) / 99) * (height - 4) : height - 2 }));
  return <svg aria-label="Recent confirmed ranking trend" className="rank-trend" role="img" viewBox={`0 0 ${width} ${height}`}><polyline points={plotted.map((point) => `${point.x},${point.y}`).join(" ")} />{plotted.map((point, index) => <circle cx={point.x} cy={point.y} key={`${measured[index].observedAt}-${index}`} r="2.5" />)}</svg>;
}
