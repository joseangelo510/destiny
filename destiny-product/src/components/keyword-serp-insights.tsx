"use client";

import { FormEvent, useState } from "react";
import type { KeywordPageType, KeywordSerpSnapshot } from "@/lib/seo/research";

const PAGE_TYPE_LABELS: Record<KeywordPageType, string> = {
  homepage: "Homepage",
  blog_post: "Blog post",
  service_page: "Service page",
  product_page: "Product page",
  category_page: "Category page",
  video: "Video",
  tool_or_app: "Tool or app",
  other: "Other page",
};

export function pageTypeLabel(value: KeywordPageType) {
  return PAGE_TYPE_LABELS[value];
}

type InsightProps = {
  checkedAt?: string;
  questions: string[];
  related: string[];
  available?: boolean;
  onResearch: (keyword: string) => void;
  onSave: (keyword: string) => void;
};

export function KeywordSerpInsights({ checkedAt, questions, related, available = true, onResearch, onSave }: InsightProps) {
  const evidence = checkedAt ? `From live Google results · checked ${new Date(checkedAt).toLocaleDateString()}` : "Live Google evidence unavailable";
  return <section className="keyword-insight-grid" aria-label="Keyword opportunities from Google">
    <article className="research-card keyword-insight-card">
      <div className="research-card-heading"><strong>Questions people ask</strong><span>{evidence}</span></div>
      {!available ? <p className="keyword-insight-empty" role="alert">Destiny couldn’t load Google’s question results for this search. Your keyword ideas are still available below.</p>
        : questions.length ? <ul>{questions.map((question) => <li key={question}><span>{question}</span><button onClick={() => onSave(question)} type="button">Save</button></li>)}</ul>
          : <p className="keyword-insight-empty">Google didn’t show a questions box for this search.</p>}
    </article>
    <article className="research-card keyword-insight-card">
      <div className="research-card-heading"><strong>Other keyword opportunities</strong><span>{evidence}</span></div>
      {!available ? <p className="keyword-insight-empty" role="alert">Related Google searches are unavailable right now.</p>
        : related.length ? <ul>{related.map((keyword) => <li key={keyword}><span>{keyword}</span><div><button onClick={() => onSave(keyword)} type="button">Save</button><button onClick={() => onResearch(keyword)} type="button">Research this</button></div></li>)}</ul>
          : <p className="keyword-insight-empty">No additional related searches appeared in this result.</p>}
    </article>
  </section>;
}

type DrawerProps = {
  keyword: string;
  snapshot?: KeywordSerpSnapshot;
  loading: boolean;
  error?: string;
  onRetry: () => void;
  onClose: () => void;
  onSave: (keyword: string) => void;
};

export function KeywordSerpDrawer({ keyword, snapshot, loading, error, onRetry, onClose, onSave }: DrawerProps) {
  return <section className="keyword-serp-drawer" aria-label={`First-page results for ${keyword}`}>
    <header><div><span className="research-kicker">Live first-page evidence</span><h3>{keyword}</h3><p>{snapshot ? `Google · ${snapshot.location} · checked ${new Date(snapshot.checkedAt).toLocaleString()}` : "Google · United States · English"}</p></div><button aria-label="Close first-page results" onClick={onClose} type="button">×</button></header>
    {loading ? <div className="keyword-serp-loading" aria-live="polite">Checking Google’s first page…</div> : null}
    {error ? <div className="keyword-serp-error" role="alert"><strong>We couldn’t load live results for this keyword.</strong><p>{error}</p><button onClick={onRetry} type="button">Try again</button></div> : null}
    {snapshot ? <>
      <div className="keyword-serp-heading"><strong>Who ranks on page one</strong><span>Page types are estimated from the public page address.</span></div>
      {snapshot.organic.length ? <ol className="keyword-serp-results">{snapshot.organic.map((row) => <li key={`${row.position}-${row.url}`}><b>{row.position}</b><div><a href={row.url} rel="noreferrer" target="_blank">{row.title || row.domain} ↗</a><small>{row.domain}</small></div><span className={`page-type-chip ${row.pageType}`}>{pageTypeLabel(row.pageType)}</span></li>)}</ol> : <p className="keyword-insight-empty">Google did not return ten standard organic pages for this search.</p>}
      <div className="keyword-serp-questions"><strong>Questions connected to this keyword</strong>{snapshot.questions.length ? <ul>{snapshot.questions.map((question) => <li key={question}><span>{question}</span><button onClick={() => onSave(question)} type="button">Save</button></li>)}</ul> : <p>Google didn’t show a questions box for this keyword.</p>}</div>
    </> : null}
  </section>;
}

export type KeywordListOption = { id: string; name: string };

type SavePanelProps = {
  keywords: string[];
  lists: KeywordListOption[];
  saving: boolean;
  onCancel: () => void;
  onCreateList: (name: string) => Promise<KeywordListOption | null>;
  onSave: (listId: string | null, track: boolean) => Promise<void>;
};

export function KeywordSavePanel({ keywords, lists, saving, onCancel, onCreateList, onSave }: SavePanelProps) {
  const [listId, setListId] = useState("");
  const [track, setTrack] = useState(false);
  const [newList, setNewList] = useState("");
  async function createList(event: FormEvent) {
    event.preventDefault();
    const created = await onCreateList(newList);
    if (created) { setListId(created.id); setNewList(""); }
  }
  return <section className="keyword-save-panel" aria-label="Save keywords to a list">
    <div><span className="research-kicker">Save for later</span><h3>{keywords.length === 1 ? keywords[0] : `${keywords.length} keyword ideas selected`}</h3><p>Saving keeps the idea in this website’s workspace. Rank checks start only when you choose tracking.</p></div>
    <label><span>Keyword list</span><select aria-label="Keyword list" onChange={(event) => setListId(event.target.value)} value={listId}><option value="">General</option>{lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}</select></label>
    <label className="keyword-track-choice"><input checked={track} onChange={(event) => setTrack(event.target.checked)} type="checkbox" /><span><strong>Also track rankings weekly</strong><small>Starts provider rank checks for these keywords.</small></span></label>
    <div className="keyword-save-actions"><button className="primary-button" disabled={saving} onClick={() => void onSave(listId || null, track)} type="button">{saving ? "Saving…" : track ? "Save and track" : "Save keywords"}</button><button className="secondary-button" onClick={onCancel} type="button">Cancel</button></div>
    <form className="keyword-new-list" onSubmit={createList}><input aria-label="New keyword list name" onChange={(event) => setNewList(event.target.value)} placeholder="New list name" value={newList} /><button className="secondary-button" disabled={!newList.trim()} type="submit">Create list</button></form>
  </section>;
}
