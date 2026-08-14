"use client";

import { WorkspaceLink as Link } from "./workspace-link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
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
import { readArticleGenerationStream, type ArticleGenerationPhase } from "@/lib/content/generation-stream";

type EditableDraft = ArticleDraft & { approved: boolean; failureReason?: string };
const ARTICLE_GENERATION_CLIENT_TIMEOUT_MS = 285_000;

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
    ? saved.metaDescriptions.filter((item): item is string => typeof item === "string").slice(0, 1).map(fitMetaDescription)
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
    failureReason: typeof saved.failureReason === "string" ? saved.failureReason : undefined,
  };
}

function mergeSavedDrafts(fallbacks: ArticleDraft[], saved: unknown) {
  if (!Array.isArray(saved)) return fallbacks.map((item) => ({ ...item, approved: false }));
  const byKeyword = new Map(saved.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const keyword = (item as Partial<EditableDraft>).keyword;
    return typeof keyword === "string" ? [[keyword, item] as const] : [];
  }));
  return fallbacks.map((fallback) => normalizeSavedDraft(byKeyword.get(fallback.keyword), fallback));
}

function issueCategory(code: string) {
  if (code === "generation_required") return "Full article generation";
  if (code === "incomplete_output") return "Article completion";
  if (code === "word_count") return "Article depth";
  if (code.startsWith("heading_")) return "Heading structure";
  if (code.startsWith("brigade_") || code === "stock_phrase") return "Writing rhythm";
  if (code === "source_coverage") return "Research and citations";
  if (code === "meta_descriptions") return "Search metadata";
  return "Editorial quality";
}

export function ArticleReviewWorkspace({
  auditId,
  websiteId,
  wordpressConnected,
  initialDrafts,
  generationContext,
  generationAvailable,
  generationModelLabel,
  questId,
  questStatus,
}: {
  auditId: string;
  websiteId: string;
  wordpressConnected: boolean;
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
  const [generationSeconds, setGenerationSeconds] = useState(0);
  const [generationPhase, setGenerationPhase] = useState<ArticleGenerationPhase>("researching");
  const [error, setError] = useState("");
  const [delivering, setDelivering] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [wordpressDrafts, setWordpressDrafts] = useState<Record<string, string>>({});
  const generationControllerRef = useRef<AbortController | null>(null);
  const generationAbortReasonRef = useRef<"cancelled" | "timeout" | null>(null);
  const draftRevisionRef = useRef(0);
  const persistedDraftRevisionRef = useRef(0);
  const [qualityCheck, setQualityCheck] = useState<{ signature: string; issues: ArticleDraft["qualityIssues"] }>({ signature: "", issues: [] });

  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      let hydrated = initialDrafts.map((item) => ({ ...item, approved: false }));
      try {
        const saved = window.localStorage.getItem(storageKey);
        if (saved) hydrated = mergeSavedDrafts(initialDrafts, JSON.parse(saved) as unknown);
      } catch { /* Browser storage is a convenience, never an approval gate. */ }

      try {
        const response = await fetch(`/api/content/drafts?websiteId=${encodeURIComponent(websiteId)}&auditId=${encodeURIComponent(auditId)}`);
        const payload = await response.json() as { drafts?: unknown };
        if (response.ok && Array.isArray(payload.drafts) && payload.drafts.length) {
          hydrated = mergeSavedDrafts(hydrated, payload.drafts);
        }
      } catch { /* Offline editing can continue from the local copy. */ }

      if (!cancelled) {
        setDrafts(hydrated);
        setStorageReady(true);
      }
    };
    void hydrate();
    return () => { cancelled = true; };
  }, [auditId, initialDrafts, storageKey, websiteId]);

  useEffect(() => {
    if (!storageReady) return;
    try { window.localStorage.setItem(storageKey, JSON.stringify(drafts)); } catch { /* Keep editing even if storage is unavailable. */ }
    if (draftRevisionRef.current <= persistedDraftRevisionRef.current) return;
    const revision = draftRevisionRef.current;
    const save = window.setTimeout(() => {
      void fetch("/api/content/drafts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId, auditId, drafts }),
      }).then(async (response) => {
        if (response.ok) {
          persistedDraftRevisionRef.current = Math.max(persistedDraftRevisionRef.current, revision);
          return;
        }
        const payload = await response.json().catch(() => ({})) as { error?: string };
        setError(payload.error || "Destiny could not save the article draft yet.");
      }).catch(() => setError("Destiny could not save the article draft yet."));
    }, 500);
    return () => window.clearTimeout(save);
  }, [auditId, drafts, storageKey, storageReady, websiteId]);

  const draft = drafts[selected];
  const qualitySignature = draft ? JSON.stringify([draft.title, draft.body, draft.metaDescriptions, draft.bucketBrigades, draft.sources, draft.preferences.format, draft.generationStatus]) : "";
  const qualityIssues = qualityCheck.signature === qualitySignature ? qualityCheck.issues : [];
  const qualityVerified = qualityCheck.signature === qualitySignature;
  const approvedCount = drafts.filter((item) => item.approved).length;
  const wordCount = useMemo(() => draft ? markdownWordCount(draft.body) : 0, [draft]);
  const canApprove = Boolean(draft?.generationStatus === "generated" && qualityVerified && qualityIssues.length === 0);
  const issueCategories = [...new Set(qualityIssues.map((issue) => issueCategory(issue.code)))];

  useEffect(() => {
    let cancelled = false;
    if (!draft) return;
    void currentArticleQualityIssues(draft).then((issues) => {
      if (!cancelled) setQualityCheck({ signature: qualitySignature, issues });
    }).catch((cause: unknown) => {
      if (!cancelled) {
        setQualityCheck({ signature: qualitySignature, issues: [{ code: "generation_required", message: "Destiny could not verify the article rules. Try again before approval." }] });
        console.error("logos_article_quality", { fallbacks: 0, wasm_errors: 1, cause });
      }
    });
    return () => { cancelled = true; };
  }, [draft, qualitySignature]);

  useEffect(() => {
    if (!generating) return;
    const startedAt = Date.now();
    const interval = window.setInterval(() => setGenerationSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(interval);
  }, [generating]);

  useEffect(() => () => generationControllerRef.current?.abort(), []);

  const updateDraft = (change: (current: EditableDraft) => EditableDraft) => {
    draftRevisionRef.current += 1;
    setDrafts((current) => current.map((item, index) => index === selected ? change(item) : item));
  };

  const updateText = (field: "title" | "body", value: string) => {
    updateDraft((current) => ({ ...current, [field]: value, approved: false }));
  };

  const updateMetaDescription = (index: number, value: string) => {
    updateDraft((current) => {
      const metaDescriptions = [...current.metaDescriptions];
      while (metaDescriptions.length < 1) metaDescriptions.push("");
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
      failureReason: current.generationStatus === "generated" ? "Settings changed. Generate a new article when you are ready." : current.failureReason,
    }));
  };

  const generate = async () => {
    if (!draft || generating) return;
    const controller = new AbortController();
    generationControllerRef.current = controller;
    generationAbortReasonRef.current = null;
    const timeout = window.setTimeout(() => {
      generationAbortReasonRef.current = "timeout";
      controller.abort();
    }, ARTICLE_GENERATION_CLIENT_TIMEOUT_MS);
    setGenerationSeconds(0);
    setGenerationPhase("researching");
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
        signal: controller.signal,
      });
      const payload = response.ok
        ? await readArticleGenerationStream<{ draft?: ArticleDraft; error?: string }>(response.body, setGenerationPhase)
        : await response.json().catch(() => ({})) as { draft?: ArticleDraft; error?: string };
      if (!response.ok || !payload.draft) throw new Error(payload.error || "Destiny could not generate this article.");
      updateDraft(() => ({ ...payload.draft!, approved: false, failureReason: undefined }));
    } catch (cause) {
      const failureReason = generationAbortReasonRef.current === "cancelled"
        ? "Generation cancelled. Your brief is saved."
        : generationAbortReasonRef.current === "timeout"
        ? "Generation took longer than expected. Your brief is saved—try again when you are ready."
        : cause instanceof Error ? cause.message : "Destiny could not generate this article.";
      setError(failureReason);
      updateDraft((current) => ({ ...current, generationStatus: "needs_generation", approved: false, failureReason }));
    } finally {
      window.clearTimeout(timeout);
      generationControllerRef.current = null;
      setGenerating(false);
    }
  };

  const cancelGeneration = () => {
    if (!generationControllerRef.current) return;
    generationAbortReasonRef.current = "cancelled";
    generationControllerRef.current.abort();
  };

  const toggleApproved = () => {
    if (!draft) return;
    if (!draft.approved && !canApprove) return;
    updateDraft((current) => ({ ...current, approved: !current.approved }));
  };

  const downloadWordDocument = async () => {
    if (!draft || exporting) return;
    setExporting(true);
    setError("");
    try {
      const response = await fetch("/api/content/word", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId, draft }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error || "Destiny could not create the Word document.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${draft.keyword.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLocaleLowerCase() || "destiny-article"}.docx`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Destiny could not create the Word document.");
    } finally {
      setExporting(false);
    }
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

  const sendToWordPress = async () => {
    if (!draft?.approved || delivering || !wordpressConnected) return;
    setDelivering(true);
    setError("");
    try {
      const response = await fetch("/api/integrations/cms/wordpress/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteId,
          auditId,
          keyword: draft.keyword,
          title: draft.title,
          body: draft.body,
          metaDescription: draft.metaDescription,
          approved: draft.approved,
          generationStatus: draft.generationStatus,
        }),
      });
      const payload = await response.json() as { error?: string; remoteEditUrl?: string };
      if (!response.ok || !payload.remoteEditUrl) throw new Error(payload.error || "Destiny could not create the WordPress draft.");
      setWordpressDrafts((current) => ({ ...current, [draft.keyword]: payload.remoteEditUrl! }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Destiny could not create the WordPress draft.");
    } finally {
      setDelivering(false);
    }
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
  return <section className="article-review-workspace" id="article-review-workspace">
    <div className="article-topic-rail">
      <div><span className="eyebrow">This week</span><h2>Create and review three articles</h2><p>Choose the writing direction, generate each full article, then review the evidence and approve.</p><strong>{approvedCount} of {drafts.length} approved</strong></div>
      {drafts.map((item, index) => <button className={index === selected ? "active" : ""} key={item.keyword} onClick={() => { setSelected(index); setError(""); }} type="button"><span>{item.approved ? "✓" : index + 1}</span><div><strong>{item.generationStatus === "generated" ? item.title : `Article ${index + 1}`}</strong><small>{item.generationStatus === "generated" ? "Complete article" : item.generationStatus === "needs_generation" ? "Ready to retry" : "Brief ready"} · {item.keyword}</small></div></button>)}
    </div>

    <div className="article-editor workspace-card">
      <section className="article-generation-controls" aria-labelledby="article-generation-heading">
        <div className="article-generation-heading"><div><span className="eyebrow">Article brief</span><h2 id="article-generation-heading">Create a complete article</h2><p><strong>{draft.keyword}</strong> · Destiny uses your business context, live web research, and these preferences. Only a complete, quality-gated article appears for review.</p></div><span className="model-chip">{generationAvailable ? generationModelLabel : "Article model unavailable"}</span></div>
        <div className="article-preference-grid">
          <label>Voice<select disabled={generating} value={draft.preferences.voice} onChange={(event) => updatePreference("voice", event.target.value as ArticleGenerationPreferences["voice"])}>{ARTICLE_VOICE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><small>{ARTICLE_VOICE_OPTIONS.find((option) => option.value === draft.preferences.voice)?.description}</small></label>
          <label>Format<select disabled={generating} value={draft.preferences.format} onChange={(event) => updatePreference("format", event.target.value as ArticleGenerationPreferences["format"])}>{ARTICLE_FORMAT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><small>{ARTICLE_FORMAT_OPTIONS.find((option) => option.value === draft.preferences.format)?.description}</small></label>
          <label>Reading ease<select disabled={generating} value={draft.preferences.readingEase} onChange={(event) => updatePreference("readingEase", event.target.value as ArticleGenerationPreferences["readingEase"])}>{READING_EASE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><small>{READING_EASE_OPTIONS.find((option) => option.value === draft.preferences.readingEase)?.description}</small></label>
        </div>
        <label>Special instructions<textarea disabled={generating} rows={3} placeholder="Add required examples, points to include, or brand guidance." value={draft.preferences.specialInstructions} onChange={(event) => updatePreference("specialInstructions", event.target.value)} /></label>
        <label className="article-infographic-toggle"><input disabled={generating} type="checkbox" checked={draft.preferences.addInfographics} onChange={(event) => updatePreference("addInfographics", event.target.checked)} /><span><strong>Create original infographics</strong><small>Destiny will design downloadable SVG graphics from verified data or article-derived steps.</small></span></label>
        <div className="article-generation-actions"><button className="primary-button article-generate-button" disabled={generating || !generationAvailable} onClick={() => void generate()} type="button">{!generationAvailable ? "Article generation is not configured" : generating ? generationPhase === "finishing" ? "Finishing the article…" : "Researching and writing…" : draft.generationStatus === "generated" ? "Generate a new article" : `Generate with ${generationModelLabel}`}</button>{generating && <button className="secondary-button" onClick={cancelGeneration} type="button">Cancel generation</button>}</div>
        {generating && <div className="configuration-note" role="status"><strong>{generationPhase === "researching" ? "Finding and verifying search sources" : generationPhase === "finishing" ? "Completing the remaining sections" : "Writing from the evidence pack"}</strong><p>Destiny verifies DataForSEO search evidence first, then Claude writes the 2,000–3,000-word article. If the first response ends early, Destiny performs one bounded completion pass. {generationSeconds}s elapsed. Cancel anytime—your brief is saved.</p></div>}
        {!generating && draft.generationStatus !== "generated" && <div className="configuration-note" role="status"><strong>{draft.failureReason ? "Generation did not complete" : "Brief saved"}</strong><p>{draft.failureReason || "Set the direction above, then generate the complete article. There is no outline to review first."}</p></div>}
        {!generationAvailable && <div className="configuration-note" role="status"><strong>Article generation is not configured</strong><p>Your brief is still saved and ready to run once the writing model is connected.</p></div>}
        {error && <div className="error-banner" role="alert">{error}</div>}
      </section>

      {draft.generationStatus === "generated" && <>
        <div className="article-draft-divider"><span>Generated article</span><strong>{wordCount.toLocaleString()} words</strong></div>
        <label>SEO title<input value={draft.title} onChange={(event) => updateText("title", event.target.value)} /></label>
        <div className="article-meta-grid">
          {[0].map((index) => <label key={index}>Meta description<textarea rows={3} maxLength={150} value={draft.metaDescriptions[index] ?? ""} onChange={(event) => updateMetaDescription(index, event.target.value)} /><small>{(draft.metaDescriptions[index] ?? "").length}/150 characters</small></label>)}
        </div>
        <label>Article draft<textarea className="article-body-editor" rows={32} value={draft.body} onChange={(event) => updateText("body", event.target.value)} /></label>

      {draft.sources.length > 0 && <section className="article-evidence-panel"><h3>Sources used</h3><p>Review the supporting evidence before publishing.</p><ul>{draft.sources.map((source) => <li key={source.id}><a href={source.url} rel="noreferrer" target="_blank">{source.title}</a>{source.publisher ? <span>{source.publisher}</span> : null}</li>)}</ul></section>}
      {draft.infographics.length > 0 && <section className="article-infographic-list"><h3>Original graphics</h3><p>Download and place these in the suggested sections of the article.</p>{draft.infographics.map((graphic, index) => <article className="article-infographic-card" key={graphic.id}><div className="article-infographic-preview" dangerouslySetInnerHTML={{ __html: renderInfographicSvg(graphic) }} /><div><strong>{graphic.title}</strong><p>{graphic.insight}</p><small>{graphic.sourceLabel}</small><button className="secondary-button" onClick={() => downloadInfographic(index)} type="button">Download SVG</button></div></article>)}</section>}

        <div className="article-editor-actions">
          <button className={draft.approved ? "secondary-button" : "primary-button"} disabled={!draft.approved && !canApprove} onClick={toggleApproved} type="button">{draft.approved ? "Reopen this draft" : canApprove ? "Approve this draft" : "Generate and review before approval"}</button>
          <button className="secondary-button" disabled={exporting} onClick={() => void downloadWordDocument()} type="button">{exporting ? "Creating Word document…" : "Download editable Word document"}</button>
          {draft.approved && wordpressConnected && !wordpressDrafts[draft.keyword] && <button className="primary-button" disabled={delivering} onClick={() => void sendToWordPress()} type="button">{delivering ? "Creating WordPress draft…" : "Send to WordPress"}</button>}
          {wordpressDrafts[draft.keyword] && <a className="primary-button" href={wordpressDrafts[draft.keyword]} rel="noreferrer" target="_blank">Review in WordPress</a>}
        </div>
        {draft.approved && !wordpressConnected && <div className="configuration-note"><strong>Connect WordPress to send this draft</strong><p>Connect it once, then return here and send approved articles directly to the WordPress editor.</p><Link className="secondary-button" href="/integrations#publishing-destinations">Connect WordPress</Link></div>}
        {wordpressDrafts[draft.keyword] && <div className="integration-banner success" role="status"><strong>Draft created in WordPress</strong><p>Nothing is live. Review the formatting in WordPress, then publish it when you are ready.</p></div>}
      </>}
    </div>

    <aside className="article-optimization workspace-card">
      <span className="eyebrow">Editorial status</span>
      <div className={`article-quality-state ${canApprove ? "ready" : "needs-work"}`}><strong>{canApprove ? "Ready for human review" : draft.generationStatus === "generated" ? "Needs another pass" : "Awaiting complete article"}</strong><span>{draft.generationStatus === "generated" ? `${wordCount.toLocaleString()} words` : "Brief saved"}</span></div>
      <p>{draft.generationStatus === "generated" ? "Destiny checks the draft privately for depth, structure, research, and writing quality. This is not a promise of rankings." : "Destiny will run its quality checks only after a complete article is generated."}</p>
      {draft.generationStatus === "generated" && (canApprove ? <div className="article-quality-summary"><strong>Internal checks passed</strong><p>Confirm the business claims, links, sources, graphics, and offer before approval.</p></div> : <div className="article-quality-summary"><strong>Areas Destiny will improve</strong><ul>{issueCategories.map((category) => <li key={category}>{category}</li>)}</ul></div>)}
      {draft.generatedBy && <small className="article-generated-by">Generated by {draft.generatedBy}</small>}
      <Link className="secondary-button" href="/integrations">Connect CMS</Link>
      <button className="primary-button" disabled={!questId || approvedCount !== drafts.length || saving || questStatus === "complete"} onClick={() => void finish()} type="button">{questStatus === "complete" ? "Weekly content approved" : saving ? "Saving…" : "Finish weekly content review"}</button>
    </aside>
  </section>;
}
