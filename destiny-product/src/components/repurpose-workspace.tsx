"use client";

import { useCallback, useId, useRef, useState } from "react";
import { WorkspaceLink } from "./workspace-link";
import {
  REPURPOSE_OUTPUT_OPTIONS,
  REPURPOSE_SOURCE_MODES,
  type RepurposeOutput,
  type RepurposeSourceMode,
  type RepurposeStage,
  isRepurposeOutput,
  repurposeStageLabel,
} from "@/lib/content/repurpose";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SourceRecord = {
  sourceId: string;
  attribution: string;
  url?: string;
};

export type DraftRecord = {
  title: string;
  bodyMarkdown: string;
  output: RepurposeOutput;
  sourceId: string;
  sourceAttribution: string;
  sourceUrl?: string;
};

export function parseRepurposeSourceResponse(value: unknown): SourceRecord | null {
  const payload = value && typeof value === "object"
    ? value as { source?: { id?: unknown; attribution?: unknown; url?: unknown } }
    : {};
  const source = payload.source;
  if (
    !source
    || typeof source.id !== "string"
    || typeof source.attribution !== "string"
  ) return null;
  return {
    sourceId: source.id,
    attribution: source.attribution,
    url: typeof source.url === "string" ? source.url : undefined,
  };
}

export function parseRepurposeGenerateResponse(
  value: unknown,
  expectedSourceId: string,
  output: RepurposeOutput,
  source: SourceRecord | null,
): DraftRecord | null {
  const payload = value && typeof value === "object"
    ? value as {
        sourceId?: unknown;
        attribution?: unknown;
        draft?: { title?: unknown; bodyMarkdown?: unknown };
      }
    : {};
  if (
    payload.sourceId !== expectedSourceId
    || !payload.draft
    || typeof payload.draft.title !== "string"
    || typeof payload.draft.bodyMarkdown !== "string"
  ) return null;
  return {
    title: payload.draft.title,
    bodyMarkdown: payload.draft.bodyMarkdown,
    output,
    sourceId: expectedSourceId,
    sourceAttribution: typeof payload.attribution === "string"
      ? payload.attribution
      : source?.attribution ?? "",
    sourceUrl: source?.url,
  };
}

// ---------------------------------------------------------------------------
// Stage strip
// ---------------------------------------------------------------------------

const STAGES: RepurposeStage[] = ["uploading", "reading", "writing", "ready"];

function StageStrip({ stage }: { stage: RepurposeStage | null }) {
  const activeIndex = stage ? STAGES.indexOf(stage) : -1;
  return (
    <ol aria-label="Progress" className="repurpose-stage-strip">
      {STAGES.map((s, i) => {
        const isDone = activeIndex > i;
        const isActive = activeIndex === i;
        return (
          <li
            key={s}
            className={isDone ? "complete" : isActive ? "active" : ""}
            aria-current={isActive ? "step" : undefined}
          >
            <span>{i + 1}</span>
            <strong>{repurposeStageLabel(s)}</strong>
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Output radio cards
// ---------------------------------------------------------------------------

function OutputCards({
  value,
  onChange,
  disabled,
}: {
  value: RepurposeOutput | null;
  onChange: (v: RepurposeOutput) => void;
  disabled: boolean;
}) {
  const name = useId();
  return (
    <fieldset className="repurpose-output-fieldset">
      <legend>Choose an output format</legend>
      <div className="repurpose-output-grid">
        {REPURPOSE_OUTPUT_OPTIONS.map((option) => (
          <label
            key={option.value}
            className={`repurpose-output-card${value === option.value ? " selected" : ""}`}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={(event) => {
                if (isRepurposeOutput(event.currentTarget.value)) {
                  onChange(event.currentTarget.value);
                }
              }}
              disabled={disabled}
            />
            <strong>{option.label}</strong>
            <span>{option.promise}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function RepurposeWorkspace({
  websiteId,
  approvedKeywords,
  generationAvailable,
  initialDraft,
}: {
  websiteId: string;
  approvedKeywords: string[];
  generationAvailable: boolean;
  initialDraft?: DraftRecord;
}) {
  // --- Source step state ---
  const [sourceMode, setSourceMode] = useState<RepurposeSourceMode>("file");
  const [urlValue, setUrlValue] = useState("");
  const [textValue, setTextValue] = useState("");
  const [fileValue, setFileValue] = useState<File | null>(null);
  const [source, setSource] = useState<SourceRecord | null>(
    initialDraft
      ? {
          sourceId: initialDraft.sourceId,
          attribution: initialDraft.sourceAttribution,
          url: initialDraft.sourceUrl,
        }
      : null,
  );
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [sourceLoading, setSourceLoading] = useState(false);

  // --- Output step state ---
  const [output, setOutput] = useState<RepurposeOutput | null>(
    initialDraft?.output ?? null,
  );
  const [targetKeyword, setTargetKeyword] = useState<string>("");

  // --- Generation state ---
  const [draft, setDraft] = useState<DraftRecord | null>(initialDraft ?? null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  // --- Save state ---
  const [editTitle, setEditTitle] = useState(initialDraft?.title ?? "");
  const [editBody, setEditBody] = useState(initialDraft?.bodyMarkdown ?? "");
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // --- Stage ---
  const [stage, setStage] = useState<RepurposeStage | null>(
    initialDraft ? "ready" : null,
  );

  const fileRef = useRef<HTMLInputElement>(null);
  const keywordSelectId = useId();

  // --- Derived ---
  const canGenerate = Boolean(source && output && generationAvailable && !generating);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFileValue(f);
    setSourceError(null);
  }, []);

  const handleAddSource = useCallback(async () => {
    setSourceError(null);
    setSourceLoading(true);

    const fd = new FormData();
    fd.append("websiteId", websiteId);
    fd.append("sourceMode", sourceMode);

    if (sourceMode === "file") {
      if (!fileValue) {
        setSourceError("Please choose a file before continuing.");
        setSourceLoading(false);
        return;
      }
      setStage("uploading");
      fd.append("file", fileValue);
    } else if (sourceMode === "url") {
      if (!urlValue.trim()) {
        setSourceError("Please enter a URL before continuing.");
        setSourceLoading(false);
        return;
      }
      setStage("reading");
      fd.append("url", urlValue.trim());
    } else {
      if (!textValue.trim()) {
        setSourceError("Please paste some text before continuing.");
        setSourceLoading(false);
        return;
      }
      setStage("reading");
      fd.append("text", textValue.trim());
    }

    try {
      const res = await fetch("/api/content/repurpose/sources", {
        method: "POST",
        body: fd,
      });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = (json && typeof json === "object" && "error" in json && typeof (json as Record<string, unknown>).error === "string")
          ? (json as Record<string, string>).error
          : `Server error ${res.status}. Please try again.`;
        setSourceError(msg);
        setStage(null);
        return;
      }
      const accepted = parseRepurposeSourceResponse(json);
      if (!accepted) {
        setSourceError("Rebound SEO accepted the request but returned incomplete source details. Please try again.");
        setStage(null);
        return;
      }
      setSource(accepted);
      // Source accepted — stays Reading until generation starts
      setStage("reading");
    } catch {
      setSourceError("Network error. Please check your connection and try again.");
      setStage(null);
    } finally {
      setSourceLoading(false);
    }
  }, [websiteId, sourceMode, fileValue, urlValue, textValue]);

  const handleGenerate = useCallback(async (sourceIdOverride?: string) => {
    if (!source && !sourceIdOverride) return;
    if (!output) return;
    const sourceId = sourceIdOverride ?? source!.sourceId;

    setGenerating(true);
    setGenerateError(null);
    setStage("writing");

    try {
      const res = await fetch("/api/content/repurpose/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteId,
          sourceId,
          output,
          targetKeyword: targetKeyword || undefined,
        }),
      });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = (json && typeof json === "object" && "error" in json && typeof (json as Record<string, unknown>).error === "string")
          ? (json as Record<string, string>).error
          : `Generation failed (${res.status}). Please try again.`;
        setGenerateError(msg);
        setStage("reading");
        return;
      }
      const newDraft = parseRepurposeGenerateResponse(json, sourceId, output, source);
      if (!newDraft) {
        setGenerateError("Rebound SEO generated a response in an unexpected format. Your source is saved; retry generation.");
        setStage("reading");
        return;
      }
      setDraft(newDraft);
      setEditTitle(newDraft.title);
      setEditBody(newDraft.bodyMarkdown);
      setSaveStatus(null);
      setStage("ready");
    } catch {
      setGenerateError("Network error during generation. Please try again.");
      setStage("reading");
    } finally {
      setGenerating(false);
    }
  }, [source, output, websiteId, targetKeyword]);

  const handleRetry = useCallback(() => {
    if (!draft) return;
    // Retry must not call sources endpoint — reuse same sourceId
    handleGenerate(draft.sourceId);
  }, [draft, handleGenerate]);

  const handleSave = useCallback(async () => {
    if (!draft) return;
    setSaving(true);
    setSaveStatus(null);
    try {
      const res = await fetch("/api/content/repurpose/sources", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteId,
          sourceId: draft.sourceId,
          title: editTitle,
          bodyMarkdown: editBody,
        }),
      });
      if (!res.ok) {
        const json: unknown = await res.json().catch(() => null);
        const msg = (json && typeof json === "object" && "error" in json && typeof (json as Record<string, unknown>).error === "string")
          ? (json as Record<string, string>).error
          : `Save failed (${res.status}). Please try again.`;
        setSaveStatus(`Error: ${msg}`);
        return;
      }
      setSaveStatus("Changes saved.");
    } catch {
      setSaveStatus("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [draft, websiteId, editTitle, editBody]);

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const isSeoOutput = draft?.output === "seo_blog_article";

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="repurpose-workspace">
      <StageStrip stage={stage} />

      {/* ------------------------------------------------------------------ */}
      {/* Step 1 — Add source                                                 */}
      {/* ------------------------------------------------------------------ */}
      <section className="workspace-card repurpose-step" aria-labelledby="repurpose-step1-label">
        <div className="repurpose-step-heading">
          <span className="repurpose-step-number">1</span>
          <h2 id="repurpose-step1-label">Add a source</h2>
        </div>
        <p className="repurpose-step-desc">
          Choose how to supply the content you want to transform. Rebound SEO reads the source and drafts a new format for your review.
        </p>

        {/* Source mode tabs */}
        <div className="repurpose-mode-tabs" role="tablist" aria-label="Source type">
          {REPURPOSE_SOURCE_MODES.map((mode) => (
            <button
              key={mode}
              role="tab"
              aria-selected={sourceMode === mode}
              className={`repurpose-mode-tab${sourceMode === mode ? " active" : ""}`}
              onClick={() => { setSourceMode(mode); setSourceError(null); }}
              type="button"
              disabled={Boolean(source)}
            >
              {mode === "file" ? "File" : mode === "url" ? "Link" : "Paste text"}
            </button>
          ))}
        </div>

        {/* File input */}
        {sourceMode === "file" && (
          <div className="repurpose-source-area">
            <label className="repurpose-file-label" htmlFor="repurpose-file-input">
              Upload a document
              <small>Accepted: .pdf, .docx, .txt, .md — up to 20 MB. Files must have a readable text layer (scanned image-only PDFs are not supported).</small>
            </label>
            <input
              id="repurpose-file-input"
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.txt,.md"
              onChange={handleFileChange}
              disabled={Boolean(source)}
              className="repurpose-file-input"
            />
          </div>
        )}

        {/* URL input */}
        {sourceMode === "url" && (
          <div className="repurpose-source-area">
            <label className="repurpose-url-label" htmlFor="repurpose-url-input">
              Public URL
              <small>Supports public webpages and YouTube videos with captions. Private pages and paywalled content cannot be read.</small>
            </label>
            <input
              id="repurpose-url-input"
              type="url"
              placeholder="https://example.com/article or https://youtube.com/watch?v=…"
              value={urlValue}
              onChange={(e) => { setUrlValue(e.target.value); setSourceError(null); }}
              disabled={Boolean(source)}
              className="repurpose-text-input"
            />
          </div>
        )}

        {/* Paste text */}
        {sourceMode === "paste" && (
          <div className="repurpose-source-area">
            <label className="repurpose-text-label" htmlFor="repurpose-text-input">
              Paste your content
            </label>
            <textarea
              id="repurpose-text-input"
              placeholder="Paste article text, transcript, or notes here…"
              value={textValue}
              onChange={(e) => { setTextValue(e.target.value); setSourceError(null); }}
              rows={8}
              disabled={Boolean(source)}
              className="repurpose-textarea"
            />
          </div>
        )}

        {/* Disabled media controls */}
        <div className="repurpose-coming-soon-controls">
          <button type="button" disabled className="repurpose-coming-soon-btn" aria-disabled="true">
            <span>🎙</span> Audio recording
            <small>Coming soon — transcription connection required</small>
          </button>
          <button type="button" disabled className="repurpose-coming-soon-btn" aria-disabled="true">
            <span>🎬</span> Video file
            <small>Coming soon — transcription connection required</small>
          </button>
        </div>

        {/* Error */}
        {sourceError && (
          <div role="alert" className="repurpose-error">
            <strong>Source error</strong>
            <p>{sourceError} Check the file or URL and try again, or paste the text directly.</p>
          </div>
        )}

        {/* Source accepted confirmation */}
        {source && (
          <div className="repurpose-source-confirmed" aria-live="polite">
            <strong>Source ready:</strong> {source.attribution}
            {source.url && <> — <a href={source.url} rel="noopener noreferrer" target="_blank">{source.url}</a></>}
          </div>
        )}

        {!source && (
          <button
            type="button"
            className="primary-button repurpose-source-submit"
            onClick={handleAddSource}
            disabled={sourceLoading}
          >
            {sourceLoading ? "Reading…" : "Add source"}
          </button>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Step 2 — Choose output                                              */}
      {/* ------------------------------------------------------------------ */}
      <section className="workspace-card repurpose-step" aria-labelledby="repurpose-step2-label">
        <div className="repurpose-step-heading">
          <span className="repurpose-step-number">2</span>
          <h2 id="repurpose-step2-label">Choose one output</h2>
        </div>
        <p className="repurpose-step-desc">
          Select the format Rebound SEO should produce. Only one output is generated per run — choose the one most useful for your audience right now.
        </p>

        <OutputCards value={output} onChange={setOutput} disabled={Boolean(draft)} />

        {/* Keyword selector */}
        <div className="repurpose-keyword-row">
          <label htmlFor={keywordSelectId}>
            Target keyword <em>(optional)</em>
          </label>
          <select
            id={keywordSelectId}
            value={targetKeyword}
            onChange={(e) => setTargetKeyword(e.target.value)}
            disabled={Boolean(draft)}
            className="repurpose-keyword-select"
          >
            <option value="">None</option>
            {approvedKeywords.map((kw) => (
              <option key={kw} value={kw}>{kw}</option>
            ))}
          </select>
          {approvedKeywords.length === 0 && (
            <small className="repurpose-keyword-hint">
              No approved keywords yet. Approve topics in{" "}
              <WorkspaceLink href="/keywords">Keyword strategy</WorkspaceLink> to populate this list.
            </small>
          )}
        </div>

        {/* Generate button */}
        {!draft && (
          <>
            {generateError && (
              <div role="alert" className="repurpose-error">
                <strong>Generation error</strong>
                <p>{generateError} Please try again or choose a different output format.</p>
              </div>
            )}
            <button
              type="button"
              className="primary-button repurpose-generate-btn"
              onClick={() => handleGenerate()}
              disabled={!canGenerate}
              aria-disabled={!canGenerate}
            >
              {generating ? "Writing draft…" : "Generate draft"}
            </button>
            {!generationAvailable && (
              <p className="repurpose-generation-unavailable">
                Content generation is not configured for this workspace.
              </p>
            )}
            {!source && (
              <p className="repurpose-generation-unavailable">
                Add a source in step 1 before generating.
              </p>
            )}
          </>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Step 3 — Review draft                                               */}
      {/* ------------------------------------------------------------------ */}
      {draft && (
        <section className="workspace-card repurpose-step repurpose-draft-section" aria-labelledby="repurpose-step3-label">
          <div className="repurpose-step-heading">
            <span className="repurpose-step-number">3</span>
            <h2 id="repurpose-step3-label">Review draft</h2>
            <span className="repurpose-draft-badge">Draft</span>
          </div>
          <p className="repurpose-step-desc">
            This is a reviewable draft only. Edit the title and body below, then save your changes.
          </p>

          {/* Source attribution */}
          <div className="repurpose-attribution">
            <strong>Source:</strong> {draft.sourceAttribution}
            {draft.sourceUrl && (
              <> — <a href={draft.sourceUrl} rel="noopener noreferrer" target="_blank">{draft.sourceUrl}</a></>
            )}
          </div>

          {/* Editable title */}
          <label className="repurpose-draft-label" htmlFor="repurpose-draft-title">
            Title
          </label>
          <input
            id="repurpose-draft-title"
            type="text"
            value={editTitle}
            onChange={(e) => { setEditTitle(e.target.value); setSaveStatus(null); }}
            maxLength={120}
            className="repurpose-text-input"
          />

          {/* Editable body */}
          <label className="repurpose-draft-label" htmlFor="repurpose-draft-body">
            Body (Markdown)
          </label>
          <textarea
            id="repurpose-draft-body"
            value={editBody}
            onChange={(e) => { setEditBody(e.target.value); setSaveStatus(null); }}
            rows={20}
            maxLength={50_000}
            className="repurpose-textarea repurpose-body-textarea"
          />

          {/* Actions row */}
          <div className="repurpose-draft-actions">
            <button
              type="button"
              className="primary-button"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={handleRetry}
              disabled={generating}
            >
              {generating ? "Writing…" : "Retry generation"}
            </button>
          </div>

          {/* Save status */}
          {saveStatus && (
            <p aria-live="polite" className="repurpose-save-status">
              {saveStatus}
            </p>
          )}

          {/* Generation error on retry */}
          {generateError && (
            <div role="alert" className="repurpose-error">
              <strong>Retry error</strong>
              <p>{generateError} Please try again.</p>
            </div>
          )}

          {/* SEO handoff */}
          {isSeoOutput && (
            <div className="repurpose-handoff">
              <WorkspaceLink
                href={`/content?repurpose=${draft.sourceId}#article-review-workspace`}
                className="primary-button"
              >
                Open in Content Studio
              </WorkspaceLink>
              <p className="repurpose-handoff-note">
                This SEO article draft can be reviewed and edited inside Content Studio.
              </p>
            </div>
          )}

          {/* Non-SEO formats */}
          {!isSeoOutput && (
            <div className="repurpose-non-seo">
              <button
                type="button"
                className="secondary-button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(`${editTitle}\n\n${editBody}`);
                    setSaveStatus("Draft copied to clipboard.");
                  } catch {
                    setSaveStatus("Copy failed. Please select and copy the text manually.");
                  }
                }}
              >
                Copy draft
              </button>
              <p className="repurpose-non-seo-note">
                This format stays an editable draft; Rebound SEO does not publish it automatically.
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
