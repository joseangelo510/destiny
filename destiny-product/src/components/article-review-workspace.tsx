"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  articleCanBeApproved,
  buildWordDocument,
  currentArticleQualityIssues,
  fitMetaDescription,
  normalizeArticleBody,
  type ArticleDraft,
} from "@/lib/content/article-draft";
import {
  ARTICLE_FORMAT_OPTIONS,
  ARTICLE_VOICE_OPTIONS,
  READING_EASE_OPTIONS,
  markdownWordCount,
  renderInfographicSvg,
  type ArticleGenerationPreferences,
  type ArticleInternalPage,
} from "@/lib/content/article-generation";

type EditableDraft = ArticleDraft & { approved: boolean };

export type ArticleGenerationContext = {
  businessName: string;
  problemSolved: string;
  idealCustomer: string;
  differentiation: string;
  internalPages: ArticleInternalPage[];
};

function normalizeSavedDraft(value: unknown, fallback: ArticleDraft): EditableDraft {
  const saved = value && typeof value === "object" && !Array.isArray(value) ? value as Partial<EditableDraft> : {};
  const generationStatus = saved.generationStatus === "generated" || saved.generationStatus === "needs_generation" || saved.generationStatus === "starter"
    ? saved.generationStatus
    : fallback.generationStatus;
  const metaDescriptions = Array.isArray(saved.metaDescriptions) && saved.metaDescriptions.length
    ? saved.metaDescriptions.filter((item): item is string => typeof item === "string").slice(0, 2).map(fitMetaDescription)
    : fallback.metaDescriptions;
  return {
    ...fallback,
    ...saved,
    metaDescription: metaDescriptions[0] ?? fallback.metaDescription,
    metaDescriptions,
    body: typeof saved.body === "string" ? normalizeArticleBody(saved.body) : fallback.body,
    sources: Array.isArray(saved.sources) ? saved.sources : fallback.sources,
    infographics: Array.isArray(saved.infographics) ? saved.infographics : fallback.infographics,
    bucketBrigades: Array.isArray(saved.bucketBrigades) ? saved.bucketBrigades : fallback.bucketBrigades,
    preferences: { ...fallback.preferences, ...(saved.preferences ?? {}) },
    generationStatus,
    qualityIssues: Array.isArray(saved.qualityIssues) ? saved.qualityIssues : fallback.qualityIssues,
    approved: saved.approved === true && generationStatus === "generated",
  };
}

function issueCategory(code: string) {
  if (code === "generation_required") return "Full article generation";
  if (code === "word_count") return "Article depth";
  if (code.startsWith("heading_")) return "Heading structure";
  if (code.startsWith("brigade_") || code === "stock_phrase") return "Writing rhythm";
  if (code === "source_coverage") return "Research and citations";
  if (code === "meta_descriptions") return "Search metadata";
  return "Editorial quality";
}

export function ArticleReviewWorkspace({
  auditId,
  initialDrafts,
  generationContext,
  generationAvailable,
  generationModelLabel,
  questId,
  questStatus,
}: {
  auditId: string;
  initialDrafts: ArticleDraft[];
  generationContext: ArticleGenerationContext;
  generationAvailable: boolean;
  generationModelLabel: string;
  questId?: string;
  questStatus?: string;
}) {
  const router = useRouter();
  const storageKey = `destiny-article-drafts-${auditId}`;
  const [drafts, setDrafts] = useState<EditableDraft[]>(initialDrafts.map((draft) => ({ ...draft, approved: false })));
  const [storageReady, setStorageReady] = useState(false);
  const [selected, setSelected] = useState(0);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const hydrate = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved) as unknown;
          if (Array.isArray(parsed)) {
            setDrafts(initialDrafts.map((fallback, index) => normalizeSavedDraft(parsed[index], fallback)));
          }
        }
      } catch { /* Browser storage is a convenience, never an approval gate. */ }
      setStorageReady(true);
    }, 0);
    return () => window.clearTimeout(hydrate);
  }, [initialDrafts, storageKey]);

  useEffect(() => {
    if (!storageReady) return;
    try { window.localStorage.setItem(storageKey, JSON.stringify(drafts)); } catch { /* Keep editing even if storage is unavailable. */ }
  }, [drafts, storageKey, storageReady]);

  const draft = drafts[selected];
  const approvedCount = drafts.filter((item) => item.approved).length;
  const qualityIssues = useMemo(() => draft ? currentArticleQualityIssues(draft) : [], [draft]);
  const wordCount = useMemo(() => draft ? markdownWordCount(draft.body) : 0, [draft]);
  const canApprove = draft ? articleCanBeApproved(draft) : false;
  const issueCategories = [...new Set(qualityIssues.map((issue) => issueCategory(issue.code)))];

  const updateDraft = (change: (current: EditableDraft) => EditableDraft) => {
    setDrafts((current) => current.map((item, index) => index === selected ? change(item) : item));
  };

  const updateText = (field: "title" | "body", value: string) => {
    updateDraft((current) => ({ ...current, [field]: value, approved: false }));
  };

  const updateMetaDescription = (index: number, value: string) => {
    updateDraft((current) => {
      const metaDescriptions = [...current.metaDescriptions];
      while (metaDescriptions.length < 2) metaDescriptions.push("");
      metaDescriptions[index] = value;
      return { ...current, metaDescriptions, metaDescription: metaDescriptions[0], approved: false };
    });
  };

  const updatePreference = <Key extends keyof ArticleGenerationPreferences>(field: Key, value: ArticleGenerationPreferences[Key]) => {
    updateDraft((current) => ({
      ...current,
      preferences: { ...current.preferences, [field]: value },
      generationStatus: current.generationStatus === "starter" ? "starter" : "needs_generation",
      approved: false,
    }));
  };

  const generate = async () => {
    if (!draft || generating) return;
    setGenerating(true);
    setError("");
    try {
      const response = await fetch("/api/content/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: draft.keyword,
          ...generationContext,
          preferences: draft.preferences,
        }),
      });
      const payload = await response.json().catch(() => ({})) as { draft?: ArticleDraft; error?: string };
      if (!response.ok || !payload.draft) throw new Error(payload.error || "Destiny could not generate this article.");
      updateDraft(() => ({ ...payload.draft!, approved: false }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Destiny could not generate this article.");
    } finally {
      setGenerating(false);
    }
  };

  const toggleApproved = () => {
    if (!draft) return;
    if (!draft.approved && !canApprove) return;
    updateDraft((current) => ({ ...current, approved: !current.approved }));
  };

  const downloadWordDocument = () => {
    if (!draft) return;
    const blob = new Blob([buildWordDocument(draft)], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${draft.keyword.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLocaleLowerCase() || "destiny-article"}.doc`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const downloadInfographic = (index: number) => {
    const graphic = draft?.infographics[index];
    if (!graphic) return;
    const blob = new Blob([renderInfographicSvg(graphic)], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${graphic.id || `destiny-infographic-${index + 1}`}.svg`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const finish = async () => {
    if (!questId || approvedCount !== drafts.length) return;
    setSaving(true);
    setError("");
    const response = await fetch(`/api/quests/${encodeURIComponent(questId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "complete" }),
    });
    const payload = await response.json() as { error?: string };
    if (!response.ok) setError(payload.error || "Destiny could not save the content review.");
    else router.refresh();
    setSaving(false);
  };

  if (!drafts.length || !draft) return null;
  return <section className="article-review-workspace">
    <div className="article-topic-rail">
      <div><span className="eyebrow">This week</span><h2>Create and review three articles</h2><p>Choose the writing direction, generate each full article, then review the evidence and approve.</p><strong>{approvedCount} of {drafts.length} approved</strong></div>
      {drafts.map((item, index) => <button className={index === selected ? "active" : ""} key={item.keyword} onClick={() => { setSelected(index); setError(""); }} type="button"><span>{item.approved ? "✓" : index + 1}</span><div><strong>{item.title}</strong><small>{item.generationStatus === "generated" ? "Full draft" : item.generationStatus === "needs_generation" ? "Regenerate with new settings" : "Starter outline"} · {item.keyword}</small></div></button>)}
    </div>

    <div className="article-editor workspace-card">
      <section className="article-generation-controls" aria-labelledby="article-generation-heading">
        <div className="article-generation-heading"><div><span className="eyebrow">Writing direction</span><h2 id="article-generation-heading">Create the full article</h2><p>Destiny uses your business context, live web research, and these preferences. SEO articles target 2,000–3,000 useful words.</p></div><span className="model-chip">{generationAvailable ? generationModelLabel : "Article model unavailable"}</span></div>
        <div className="article-preference-grid">
          <label>Voice<select value={draft.preferences.voice} onChange={(event) => updatePreference("voice", event.target.value as ArticleGenerationPreferences["voice"])}>{ARTICLE_VOICE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><small>{ARTICLE_VOICE_OPTIONS.find((option) => option.value === draft.preferences.voice)?.description}</small></label>
          <label>Format<select value={draft.preferences.format} onChange={(event) => updatePreference("format", event.target.value as ArticleGenerationPreferences["format"])}>{ARTICLE_FORMAT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><small>{ARTICLE_FORMAT_OPTIONS.find((option) => option.value === draft.preferences.format)?.description}</small></label>
          <label>Reading ease<select value={draft.preferences.readingEase} onChange={(event) => updatePreference("readingEase", event.target.value as ArticleGenerationPreferences["readingEase"])}>{READING_EASE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><small>{READING_EASE_OPTIONS.find((option) => option.value === draft.preferences.readingEase)?.description}</small></label>
        </div>
        <label>Special instructions<textarea rows={3} placeholder="Add required examples, points to include, or brand guidance." value={draft.preferences.specialInstructions} onChange={(event) => updatePreference("specialInstructions", event.target.value)} /></label>
        <label className="article-infographic-toggle"><input type="checkbox" checked={draft.preferences.addInfographics} onChange={(event) => updatePreference("addInfographics", event.target.checked)} /><span><strong>Create original infographics</strong><small>Destiny will design downloadable SVG graphics from verified data or article-derived steps.</small></span></label>
        <button className="primary-button article-generate-button" disabled={generating || !generationAvailable} onClick={() => void generate()} type="button">{!generationAvailable ? "Article generation is not configured" : generating ? "Researching and writing…" : draft.generationStatus === "starter" ? `Generate with ${generationModelLabel}` : "Regenerate full article"}</button>
        {!generationAvailable && <div className="configuration-note" role="status"><strong>Starter outline available</strong><p>Full AI article generation is not active yet. You can edit or download the starter outline while the writing model is being connected.</p></div>}
        {error && <div className="error-banner" role="alert">{error}</div>}
      </section>

      <div className="article-draft-divider"><span>{draft.generationStatus === "generated" ? "Generated article" : "Editable starter outline"}</span><strong>{wordCount.toLocaleString()} words</strong></div>
      <label>SEO title<input value={draft.title} onChange={(event) => updateText("title", event.target.value)} /></label>
      <div className="article-meta-grid">
        {[0, 1].map((index) => <label key={index}>Meta description {index + 1}<textarea rows={3} maxLength={150} value={draft.metaDescriptions[index] ?? ""} onChange={(event) => updateMetaDescription(index, event.target.value)} /><small>{(draft.metaDescriptions[index] ?? "").length}/150 characters</small></label>)}
      </div>
      <label>Article draft<textarea className="article-body-editor" rows={32} value={draft.body} onChange={(event) => updateText("body", event.target.value)} /></label>

      {draft.sources.length > 0 && <section className="article-evidence-panel"><h3>Sources used</h3><p>Review the supporting evidence before publishing.</p><ul>{draft.sources.map((source) => <li key={source.id}><a href={source.url} rel="noreferrer" target="_blank">{source.title}</a>{source.publisher ? <span>{source.publisher}</span> : null}</li>)}</ul></section>}
      {draft.infographics.length > 0 && <section className="article-infographic-list"><h3>Original graphics</h3><p>Download and place these in the suggested sections of the article.</p>{draft.infographics.map((graphic, index) => <article className="article-infographic-card" key={graphic.id}><div className="article-infographic-preview" dangerouslySetInnerHTML={{ __html: renderInfographicSvg(graphic) }} /><div><strong>{graphic.title}</strong><p>{graphic.insight}</p><small>{graphic.sourceLabel}</small><button className="secondary-button" onClick={() => downloadInfographic(index)} type="button">Download SVG</button></div></article>)}</section>}

      <div className="article-editor-actions"><button className={draft.approved ? "secondary-button" : "primary-button"} disabled={!draft.approved && !canApprove} onClick={toggleApproved} type="button">{draft.approved ? "Reopen this draft" : canApprove ? "Approve this draft" : "Generate and review before approval"}</button><button className="secondary-button" onClick={downloadWordDocument} type="button">Download editable Word document</button></div>
    </div>

    <aside className="article-optimization workspace-card">
      <span className="eyebrow">Editorial status</span>
      <div className={`article-quality-state ${canApprove ? "ready" : "needs-work"}`}><strong>{canApprove ? "Ready for human review" : draft.generationStatus === "generated" ? "Needs another pass" : "Full article not generated"}</strong><span>{wordCount.toLocaleString()} words</span></div>
      <p>Destiny checks the draft privately for depth, structure, research, and writing quality. This is not a promise of rankings.</p>
      {canApprove ? <div className="article-quality-summary"><strong>Internal checks passed</strong><p>Confirm the business claims, links, sources, graphics, and offer before approval.</p></div> : <div className="article-quality-summary"><strong>Areas Destiny will improve</strong><ul>{issueCategories.map((category) => <li key={category}>{category}</li>)}</ul></div>}
      {draft.generatedBy && <small className="article-generated-by">Generated by {draft.generatedBy}</small>}
      <Link className="secondary-button" href="/integrations">Connect CMS</Link>
      <button className="primary-button" disabled={!questId || approvedCount !== drafts.length || saving || questStatus === "complete"} onClick={() => void finish()} type="button">{questStatus === "complete" ? "Weekly content approved" : saving ? "Saving…" : "Finish weekly content review"}</button>
    </aside>
  </section>;
}
