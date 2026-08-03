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
  savedDraftForKeyword,
  type ArticleDraft,
} from "../lib/content/article-draft";
import {
  ARTICLE_FORMAT_OPTIONS,
  ARTICLE_VOICE_OPTIONS,
  DEFAULT_COPY_MODEL,
  READING_EASE_OPTIONS,
  markdownWordCount,
  renderInfographicSvg,
  type ArticleGenerationCapability,
  type ArticleGenerationPreferences,
  type ArticleInternalPage,
} from "../lib/content/article-generation";
import {
  GENERATION_STAGES,
  articleTableOfContents,
  estimatedReadMinutes,
  generationStageIndex,
  parseArticleMarkdown,
  type ArticleInlineToken,
} from "../lib/content/article-markdown";

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

export function topicRailStatusLabel(status: ArticleDraft["generationStatus"]) {
  if (status === "generated") return "Full draft";
  if (status === "needs_generation") return "Regenerate with new settings";
  return "Not written yet";
}

function InlineTokens({ tokens }: { tokens: ArticleInlineToken[] }) {
  return <>{tokens.map((token, index) => {
    if (token.type === "link") return <a href={token.url} key={index} rel="noreferrer" target="_blank">{token.text}</a>;
    if (token.type === "strong") return <strong key={index}>{token.text}</strong>;
    if (token.type === "em") return <em key={index}>{token.text}</em>;
    return <span key={index}>{token.text}</span>;
  })}</>;
}

export function ArticleMarkdownPreview({ markdown }: { markdown: string }) {
  const blocks = useMemo(() => parseArticleMarkdown(markdown), [markdown]);
  return <div className="article-preview-document">
    {blocks.map((block, index) => {
      if (block.type === "heading") return block.level === 2 ? <h2 id={block.id} key={index}>{block.text}</h2> : <h3 id={block.id} key={index}>{block.text}</h3>;
      if (block.type === "list") {
        const items = block.items.map((item, itemIndex) => <li key={itemIndex}><InlineTokens tokens={item} /></li>);
        return block.ordered ? <ol key={index}>{items}</ol> : <ul key={index}>{items}</ul>;
      }
      return <p key={index}><InlineTokens tokens={block.tokens} /></p>;
    })}
  </div>;
}

export function ArticleEmptyState({ available }: { available: boolean }) {
  return <div className="article-empty-state">
    <strong>Your article hasn&apos;t been written yet.</strong>
    {available
      ? <p>Set the direction above, and Destiny will research your topic and write the full 2,000–3,000 word draft. Nothing here is placeholder — what you approve is what you publish.</p>
      : <p>Full-article generation is not configured in this environment, so Destiny cannot write this article yet.</p>}
  </div>;
}

export function GenerationProgressPanel({ stageIndex }: { stageIndex: number }) {
  return <div aria-live="polite" className="article-generation-progress" role="status">
    <ol className="article-generation-stages">
      {GENERATION_STAGES.map((stage, index) => <li className={index < stageIndex ? "done" : index === stageIndex ? "current" : ""} key={stage.label}>{stage.label}</li>)}
    </ol>
    <div aria-hidden="true" className="article-skeleton">
      <span /><span /><span /><span />
    </div>
    <p>Destiny is researching live sources and writing the full draft. This usually takes a few minutes.</p>
  </div>;
}

export function ArticleReviewWorkspace({
  auditId,
  generationCapability,
  initialDrafts,
  generationContext,
  questId,
  questStatus,
}: {
  auditId: string;
  generationCapability?: ArticleGenerationCapability;
  initialDrafts: ArticleDraft[];
  generationContext: ArticleGenerationContext;
  questId?: string;
  questStatus?: string;
}) {
  const capability = generationCapability ?? { available: true, modelLabel: DEFAULT_COPY_MODEL };
  const router = useRouter();
  const storageKey = `destiny-article-drafts-${auditId}`;
  const [drafts, setDrafts] = useState<EditableDraft[]>(initialDrafts.map((draft) => ({ ...draft, approved: false })));
  const [storageReady, setStorageReady] = useState(false);
  const [selected, setSelected] = useState(0);
  const [saving, setSaving] = useState(false);
  // Generation is tracked per draft keyword so switching topics mid-request
  // never shows the wrong topic as "writing" or hides its own article.
  const [generatingKeyword, setGeneratingKeyword] = useState<string | null>(null);
  const [stageIndex, setStageIndex] = useState(0);
  const [error, setError] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [readingMode, setReadingMode] = useState<"preview" | "edit">("preview");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const hydrate = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved) as unknown;
          if (Array.isArray(parsed)) {
            // Match saved drafts by keyword, not index: stale drafts persisted
            // from an earlier unvetted keyword set (competitor brands, "free"
            // phrases) must not override the vetted outlines from the server.
            setDrafts(initialDrafts.map((fallback) => normalizeSavedDraft(savedDraftForKeyword(parsed, fallback.keyword), fallback)));
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

  useEffect(() => {
    if (!generatingKeyword) return;
    const startedAt = Date.now();
    const tick = window.setInterval(() => setStageIndex(generationStageIndex(Date.now() - startedAt)), 1000);
    return () => window.clearInterval(tick);
  }, [generatingKeyword]);

  const draft = drafts[selected];
  const approvedCount = drafts.filter((item) => item.approved).length;
  const qualityIssues = useMemo(() => draft ? currentArticleQualityIssues(draft) : [], [draft]);
  const wordCount = useMemo(() => draft ? markdownWordCount(draft.body) : 0, [draft]);
  const tableOfContents = useMemo(() => draft ? articleTableOfContents(draft.body) : [], [draft]);
  const canApprove = draft ? articleCanBeApproved(draft) : false;
  const issueCategories = [...new Set(qualityIssues.map((issue) => issueCategory(issue.code)))];
  // A real article only exists after generation. "needs_generation" means a
  // generated draft exists but the direction changed since it was written.
  const hasArticle = draft ? draft.generationStatus !== "starter" : false;
  const generating = Boolean(draft && generatingKeyword === draft.keyword);
  const directionCollapsed = hasArticle && !adjusting && !generating;

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
    if (!draft || generatingKeyword) return;
    const keyword = draft.keyword;
    setStageIndex(0);
    setGeneratingKeyword(keyword);
    setError("");
    try {
      const response = await fetch("/api/content/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword,
          ...generationContext,
          preferences: draft.preferences,
        }),
      });
      const payload = await response.json().catch(() => ({})) as { draft?: ArticleDraft; error?: string };
      if (!response.ok || !payload.draft) throw new Error(payload.error || "Destiny could not generate this article.");
      // Apply the finished article to the draft it was requested for, even if
      // the user switched topics while Claude was writing.
      setDrafts((current) => current.map((item) => item.keyword === keyword ? { ...payload.draft!, approved: false } : item));
      setAdjusting(false);
      setReadingMode("preview");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Destiny could not generate this article.");
    } finally {
      setGeneratingKeyword(null);
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

  const preferenceSummary = [
    ARTICLE_VOICE_OPTIONS.find((option) => option.value === draft.preferences.voice)?.label,
    ARTICLE_FORMAT_OPTIONS.find((option) => option.value === draft.preferences.format)?.label,
    READING_EASE_OPTIONS.find((option) => option.value === draft.preferences.readingEase)?.label,
    draft.preferences.addInfographics ? "Infographics on" : "No infographics",
  ].filter(Boolean).join(" · ");

  return <section className="article-review-workspace">
    <div className="article-topic-rail">
      <div><span className="eyebrow">This week</span><h2>Create and review three articles</h2><p>Choose the writing direction, generate each full article, then review the evidence and approve.</p><strong>{approvedCount} of {drafts.length} approved</strong></div>
      {drafts.map((item, index) => <button className={index === selected ? "active" : ""} key={item.keyword} onClick={() => { setSelected(index); setError(""); setAdjusting(false); setReadingMode("preview"); setExpanded(false); }} type="button"><span>{item.approved ? "✓" : index + 1}</span><div><strong>{item.title}</strong><small>{topicRailStatusLabel(item.generationStatus)} · {item.keyword}</small></div></button>)}
    </div>

    <div className="article-editor workspace-card">
      {directionCollapsed
        ? <section className="article-direction-summary" aria-label="Writing direction summary">
            <div><span className="eyebrow">Writing direction</span><p>{preferenceSummary}{draft.preferences.specialInstructions.trim() ? " · Special instructions set" : ""}</p></div>
            <button className="secondary-button" onClick={() => setAdjusting(true)} type="button">Adjust</button>
          </section>
        : <section aria-labelledby="article-generation-heading" className={`article-generation-controls${generating ? " generating" : ""}`}>
            <div className="article-generation-heading"><div><span className="eyebrow">Writing direction</span><h2 id="article-generation-heading">Create the full article</h2><p>Destiny uses your business context, live web research, and these preferences. SEO articles target 2,000–3,000 useful words.</p></div><span className="model-chip">{capability.modelLabel}</span></div>
            <fieldset className="article-direction-fields" disabled={generating}>
              <div className="article-preference-grid">
                <label>Voice<select value={draft.preferences.voice} onChange={(event) => updatePreference("voice", event.target.value as ArticleGenerationPreferences["voice"])}>{ARTICLE_VOICE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><small>{ARTICLE_VOICE_OPTIONS.find((option) => option.value === draft.preferences.voice)?.description}</small></label>
                <label>Format<select value={draft.preferences.format} onChange={(event) => updatePreference("format", event.target.value as ArticleGenerationPreferences["format"])}>{ARTICLE_FORMAT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><small>{ARTICLE_FORMAT_OPTIONS.find((option) => option.value === draft.preferences.format)?.description}</small></label>
                <label>Reading ease<select value={draft.preferences.readingEase} onChange={(event) => updatePreference("readingEase", event.target.value as ArticleGenerationPreferences["readingEase"])}>{READING_EASE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><small>{READING_EASE_OPTIONS.find((option) => option.value === draft.preferences.readingEase)?.description}</small></label>
              </div>
              <label>Special instructions<textarea rows={3} placeholder="Add required examples, points to include, or brand guidance." value={draft.preferences.specialInstructions} onChange={(event) => updatePreference("specialInstructions", event.target.value)} /></label>
              <label className="article-infographic-toggle"><input type="checkbox" checked={draft.preferences.addInfographics} onChange={(event) => updatePreference("addInfographics", event.target.checked)} /><span><strong>Create original infographics</strong><small>Destiny will design downloadable SVG graphics from verified data or article-derived steps.</small></span></label>
            </fieldset>
            <button className="primary-button article-generate-button" disabled={Boolean(generatingKeyword) || !capability.available} onClick={() => void generate()} type="button">{!capability.available ? "Article generation is not configured" : generating ? "Researching and writing…" : draft.generationStatus === "starter" ? `Generate with ${capability.modelLabel === "claude-opus-4-8" ? "Opus 4.8" : capability.modelLabel}` : "Regenerate full article"}</button>
            {!capability.available && <p className="article-generation-unavailable">Full-article generation is not configured in this environment. Destiny will not show placeholder writing in its place.</p>}
            {error && <div className="error-banner" role="alert">{error}</div>}
          </section>}
      {directionCollapsed && error && <div className="error-banner" role="alert">{error}</div>}

      {generating
        ? <GenerationProgressPanel stageIndex={stageIndex} />
        : !hasArticle
          ? <ArticleEmptyState available={capability.available} />
          : <>
              <section className={`article-reading-pane${expanded ? " expanded" : ""}`} aria-label="Your article">
                <header className="article-reading-header">
                  <div><strong>Your article</strong><span>{wordCount.toLocaleString()} words · {estimatedReadMinutes(wordCount)} min read</span></div>
                  <div className="article-reading-tools">
                    <div className="article-view-toggle" role="group" aria-label="Article view">
                      <button className={readingMode === "preview" ? "active" : ""} onClick={() => setReadingMode("preview")} type="button">Preview</button>
                      <button className={readingMode === "edit" ? "active" : ""} onClick={() => setReadingMode("edit")} type="button">Edit</button>
                    </div>
                    <button className="secondary-button article-expand-toggle" onClick={() => setExpanded((current) => !current)} type="button">{expanded ? "Collapse" : "Expand"}</button>
                  </div>
                </header>
                <div className="article-reading-scroll">
                  {readingMode === "preview"
                    ? <>
                        {tableOfContents.length > 1 && <nav aria-label="Article sections" className="article-toc"><span>In this article</span><ul>{tableOfContents.map((entry) => <li key={entry.id}><a href={`#${entry.id}`}>{entry.text}</a></li>)}</ul></nav>}
                        <ArticleMarkdownPreview markdown={draft.body} />
                      </>
                    : <textarea aria-label="Article draft" className="article-body-editor" value={draft.body} onChange={(event) => updateText("body", event.target.value)} />}
                </div>
              </section>

              <section className="article-search-listing" aria-label="Search listing">
                <h3>Search listing</h3>
                <p>How this article can appear in Google. Meta descriptions stay within 150 characters.</p>
                <label>SEO title<input value={draft.title} onChange={(event) => updateText("title", event.target.value)} /></label>
                <div className="article-meta-grid">
                  {[0, 1].map((index) => <label key={index}>Meta description {index + 1}<textarea rows={3} maxLength={150} value={draft.metaDescriptions[index] ?? ""} onChange={(event) => updateMetaDescription(index, event.target.value)} /><small>{(draft.metaDescriptions[index] ?? "").length}/150 characters</small></label>)}
                </div>
              </section>
            </>}

      {hasArticle && !generating && draft.sources.length > 0 && <section className="article-evidence-panel"><h3>Sources used</h3><p>Review the supporting evidence before publishing.</p><ul>{draft.sources.map((source) => <li key={source.id}><a href={source.url} rel="noreferrer" target="_blank">{source.title}</a>{source.publisher ? <span>{source.publisher}</span> : null}</li>)}</ul></section>}
      {hasArticle && !generating && draft.infographics.length > 0 && <section className="article-infographic-list"><h3>Original graphics</h3><p>Download and place these in the suggested sections of the article.</p>{draft.infographics.map((graphic, index) => <article className="article-infographic-card" key={graphic.id}><div className="article-infographic-preview" dangerouslySetInnerHTML={{ __html: renderInfographicSvg(graphic) }} /><div><strong>{graphic.title}</strong><p>{graphic.insight}</p><small>{graphic.sourceLabel}</small><button className="secondary-button" onClick={() => downloadInfographic(index)} type="button">Download SVG</button></div></article>)}</section>}

      {hasArticle && !generating && <div className="article-editor-actions"><button className={draft.approved ? "secondary-button" : "primary-button"} disabled={!draft.approved && !canApprove} onClick={toggleApproved} type="button">{draft.approved ? "Reopen this draft" : canApprove ? "Approve this draft" : "Generate and review before approval"}</button><button className="secondary-button" onClick={downloadWordDocument} type="button">Download editable Word document</button></div>}
    </div>

    <aside className="article-optimization workspace-card">
      <span className="eyebrow">Editorial status</span>
      <div className={`article-quality-state ${canApprove ? "ready" : "needs-work"}`}><strong>{canApprove ? "Ready for human review" : draft.generationStatus === "generated" ? "Needs another pass" : "Full article not generated"}</strong>{hasArticle && <span>{wordCount.toLocaleString()} words</span>}</div>
      <p>Destiny checks the draft privately for depth, structure, research, and writing quality. This is not a promise of rankings.</p>
      {canApprove ? <div className="article-quality-summary"><strong>Internal checks passed</strong><p>Confirm the business claims, links, sources, graphics, and offer before approval.</p></div> : <div className="article-quality-summary"><strong>Areas Destiny will improve</strong><ul>{issueCategories.map((category) => <li key={category}>{category}</li>)}</ul></div>}
      {draft.generatedBy && <small className="article-generated-by">Generated by {draft.generatedBy}</small>}
      <Link className="secondary-button" href="/integrations">Connect CMS</Link>
      <button className="primary-button" disabled={!questId || approvedCount !== drafts.length || saving || questStatus === "complete"} onClick={() => void finish()} type="button">{questStatus === "complete" ? "Weekly content approved" : saving ? "Saving…" : "Finish weekly content review"}</button>
    </aside>
  </section>;
}
