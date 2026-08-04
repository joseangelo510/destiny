"use client";

import { FormEvent, useMemo, useState } from "react";
import { rankMovementFromReadings, rankReadingState, summarizeRankings, trackerFreshness } from "../lib/seo/rank-tracker";

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
};

type Props = { websiteId: string; initialLists: RankTrackerList[]; initialKeywords: RankTrackerKeyword[] };

export function RankTrackerWorkspace({ websiteId, initialLists, initialKeywords }: Props) {
  const [lists, setLists] = useState(initialLists);
  const [keywords, setKeywords] = useState(initialKeywords);
  const [activeList, setActiveList] = useState<string>("all");
  const [keyword, setKeyword] = useState("");
  const [listName, setListName] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const summary = useMemo(() => summarizeRankings(keywords.map((row) => ({ status: row.status, position: row.currentPosition, found: row.found }))), [keywords]);
  const visible = useMemo(() => activeList === "all" ? keywords : activeList === "general" ? keywords.filter((item) => !item.listId) : keywords.filter((item) => item.listId === activeList), [activeList, keywords]);

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

  return <div className="rank-tracker-workspace">
    <section className="rank-tracker-intro">
      <div><span className="research-kicker">Weekly Google rank tracking</span><h2>See whether your approved strategy is gaining ground.</h2><p>Destiny checks the same search context every week so movement is comparable—not guessed.</p></div>
      <div className="rank-context"><strong>Measurement context</strong><span>Google Search</span><span>United States · English · Desktop</span><small>A new keyword’s first reading usually arrives within minutes. Please allow up to 24 hours.</small></div>
    </section>

    <section className="rank-summary-grid">
      <article><span>Tracked keywords</span><strong>{summary.tracked}</strong><small>{summary.measured} measured</small></article>
      <article><span>Top 3</span><strong>{summary.top3}</strong><small>Confirmed positions</small></article>
      <article><span>Top 10</span><strong>{summary.top10}</strong><small>Confirmed positions</small></article>
      <article><span>Average position</span><strong>{summary.averagePosition ?? "—"}</strong><small>Ranked keywords only</small></article>
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
          const reading = rankReadingState({ status: row.status, position: row.currentPosition, found: row.found });
          const movement = row.status === "pending" || row.status === "error" ? { label: "—", tone: "flat" } : rankMovementFromReadings({ position: row.currentPosition, found: row.found }, row.previousFound === undefined && row.previousPosition === null ? null : { position: row.previousPosition, found: row.previousFound ?? (row.previousPosition !== null) });
          const freshness = trackerFreshness({ status: row.status, createdAt: row.createdAt, lastCheckedAt: row.lastCheckedAt });
          return <tr key={row.id}><td><strong>{row.keyword}</strong><small>{row.source === "strategy" ? "From Keyword strategy" : row.source === "research" ? "From Keyword research" : "Manually added"}</small></td><td><span className={`rank-state ${reading.tone}`}>{reading.label}</span></td><td><span className={`rank-movement ${movement.tone}`}>{movement.label}</span></td><td><RankTrend history={row.history ?? []} /></td><td>{row.resultUrl ? <a href={row.resultUrl} rel="noreferrer" target="_blank">View page ↗</a> : "—"}</td><td><span>{row.checkedAt ? new Date(row.checkedAt).toLocaleDateString() : "Pending"}</span><small>{freshness.message}</small></td><td><select aria-label={`List for ${row.keyword}`} onChange={(event) => void moveKeyword(row.id, event.target.value || null)} value={row.listId ?? ""}><option value="">General</option>{lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}</select></td></tr>;
        })}</tbody></table></div>
        {!visible.length ? <div className="rank-empty"><strong>No keywords in this list yet.</strong><p>Add one here, approve one in Keyword strategy, or track one from Keyword research.</p></div> : null}
      </div>
    </section>
    <aside className="rank-evidence-note"><strong>Accuracy rule</strong><p>Destiny records the exact location, language, device, timestamp, provider task, and result URL for every check. “Not found” means the domain did not appear within the measured top 100—it never means position zero.</p></aside>
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
