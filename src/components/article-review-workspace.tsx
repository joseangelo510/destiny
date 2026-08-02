"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { buildWordDocument, type ArticleDraft } from "@/lib/content/article-draft";

type EditableDraft = ArticleDraft & { approved: boolean };

export function ArticleReviewWorkspace({ auditId, initialDrafts, questId, questStatus }: {
  auditId: string;
  initialDrafts: ArticleDraft[];
  questId?: string;
  questStatus?: string;
}) {
  const router = useRouter();
  const storageKey = `destiny-article-drafts-${auditId}`;
  const [drafts, setDrafts] = useState<EditableDraft[]>(initialDrafts.map((draft) => ({ ...draft, approved: false })));
  const [storageReady, setStorageReady] = useState(false);
  const [selected, setSelected] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const hydrate = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(storageKey);
        if (saved) setDrafts(JSON.parse(saved) as EditableDraft[]);
      } catch { /* Browser storage is a convenience, never an approval gate. */ }
      setStorageReady(true);
    }, 0);
    return () => window.clearTimeout(hydrate);
  }, [storageKey]);

  useEffect(() => {
    if (!storageReady) return;
    try { window.localStorage.setItem(storageKey, JSON.stringify(drafts)); } catch { /* Keep editing even if storage is unavailable. */ }
  }, [drafts, storageKey, storageReady]);

  const draft = drafts[selected];
  const approvedCount = drafts.filter((item) => item.approved).length;
  const score = useMemo(() => {
    if (!draft) return 0;
    const normalizedBody = draft.body.toLocaleLowerCase();
    const wordCount = draft.body.trim().split(/\s+/).filter(Boolean).length;
    const keywordUses = normalizedBody.split(draft.keyword.toLocaleLowerCase()).length - 1;
    const headings = draft.body.split("\n").filter((line) => /^#{1,3}\s/.test(line)).length;
    return Math.min(100, 35 + Math.min(25, wordCount / 12) + Math.min(20, keywordUses * 5) + Math.min(20, headings * 3));
  }, [draft]);

  const update = (field: "title" | "metaDescription" | "body", value: string) => {
    setDrafts((current) => current.map((item, index) => index === selected ? { ...item, [field]: value, approved: false } : item));
  };
  const toggleApproved = () => setDrafts((current) => current.map((item, index) => index === selected ? { ...item, approved: !item.approved } : item));
  const download = () => {
    if (!draft) return;
    const blob = new Blob([buildWordDocument(draft)], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${draft.keyword.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLocaleLowerCase() || "destiny-article"}.doc`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const finish = async () => {
    if (!questId || approvedCount !== drafts.length) return;
    setSaving(true);
    setError("");
    const response = await fetch(`/api/quests/${encodeURIComponent(questId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "complete" }) });
    const payload = await response.json() as { error?: string };
    if (!response.ok) setError(payload.error || "Destiny could not save the content review.");
    else router.refresh();
    setSaving(false);
  };

  if (!drafts.length || !draft) return null;
  return <section className="article-review-workspace">
    <div className="article-topic-rail"><div><span className="eyebrow">This week</span><h2>Review three articles</h2><p>Approve each draft, then connect your CMS or download editable Word documents.</p><strong>{approvedCount} of {drafts.length} approved</strong></div>{drafts.map((item, index) => <button className={index === selected ? "active" : ""} key={item.keyword} onClick={() => setSelected(index)} type="button"><span>{item.approved ? "✓" : index + 1}</span><div><strong>{item.title}</strong><small>{item.keyword}</small></div></button>)}</div>
    <div className="article-editor workspace-card"><label>SEO title<input value={draft.title} onChange={(event) => update("title", event.target.value)} /></label><label>Meta description<textarea rows={3} value={draft.metaDescription} onChange={(event) => update("metaDescription", event.target.value)} /></label><label>Article draft<textarea className="article-body-editor" rows={28} value={draft.body} onChange={(event) => update("body", event.target.value)} /></label><div className="article-editor-actions"><button className={draft.approved ? "secondary-button" : "primary-button"} onClick={toggleApproved} type="button">{draft.approved ? "Reopen this draft" : "Approve this draft"}</button><button className="secondary-button" onClick={download} type="button">Download editable Word document</button></div></div>
    <aside className="article-optimization workspace-card"><span className="eyebrow">Content guidance</span><div className="content-score"><strong>{Math.round(score)}</strong><span>/100</span></div><p>This is a writing checklist, not a promise of rankings.</p>{draft.optimization.map((item) => <div key={item.label}><strong>{item.label}</strong><p>{item.detail}</p></div>)}<Link className="secondary-button" href="/integrations">Connect CMS</Link><button className="primary-button" disabled={!questId || approvedCount !== drafts.length || saving || questStatus === "complete"} onClick={() => void finish()} type="button">{questStatus === "complete" ? "Weekly content approved" : saving ? "Saving…" : "Finish weekly content review"}</button>{error && <div className="error-banner">{error}</div>}</aside>
  </section>;
}
