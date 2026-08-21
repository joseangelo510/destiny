"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { INFOGRAPHIC_STYLE_OPTIONS, type InfographicPlan, type InfographicStyle } from "@/lib/content/infographic-generation";

type KeywordOption = { keyword: string; searchVolume: number };

function errorMessage(value: unknown, fallback: string) {
  return value && typeof value === "object" && "error" in value && typeof value.error === "string" ? value.error : fallback;
}

async function downloadResponse(response: Response, fallback: string) {
  if (!response.ok) throw new Error(errorMessage(await response.json().catch(() => ({})), fallback));
  return response.blob();
}

export function InfographicGenerator({ websiteId, websiteName, approvedKeywords, generationAvailable }: {
  websiteId: string;
  websiteName: string;
  approvedKeywords: KeywordOption[];
  generationAvailable: boolean;
}) {
  const firstKeyword = approvedKeywords[0]?.keyword ?? "";
  const [topicChoice, setTopicChoice] = useState(firstKeyword ? `keyword:${firstKeyword}` : "custom");
  const [customTopic, setCustomTopic] = useState("");
  const [style, setStyle] = useState<InfographicStyle>("editorial");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [plan, setPlan] = useState<InfographicPlan | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [busy, setBusy] = useState<"research" | "visual" | "document" | "">("");
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState("");
  const topic = topicChoice === "custom" ? customTopic.trim() : topicChoice.replace(/^keyword:/, "");
  const articleWords = useMemo(() => plan?.article.markdown.replace(/https?:\/\/\S+/g, " ").replace(/[#*_`>\[\]()!-]/g, " ").trim().split(/\s+/).filter(Boolean).length ?? 0, [plan]);

  useEffect(() => () => { if (imageUrl) URL.revokeObjectURL(imageUrl); }, [imageUrl]);

  async function research() {
    if (!topic) return setError("Choose a keyword or enter your own topic.");
    setBusy("research"); setError(""); setPlan(null);
    if (imageUrl) { URL.revokeObjectURL(imageUrl); setImageUrl(""); }
    try {
      const response = await fetch("/api/content/infographic/research", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ websiteId, keyword: topic, style, specialInstructions }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(errorMessage(result, "Destiny could not research this topic."));
      setPlan(result.plan as InfographicPlan);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Destiny could not research this topic."); }
    finally { setBusy(""); }
  }

  async function createVisual() {
    if (!plan) return;
    setBusy("visual"); setError("");
    try {
      const blob = await downloadResponse(await fetch("/api/content/infographic/render", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ websiteId, plan, style }) }), "Destiny could not create the infographic.");
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      setImageUrl(URL.createObjectURL(blob));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Destiny could not create the infographic."); }
    finally { setBusy(""); }
  }

  async function downloadArticle() {
    if (!plan) return;
    setBusy("document"); setError("");
    try {
      const blob = await downloadResponse(await fetch("/api/content/infographic/document", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ websiteId, plan }) }), "Destiny could not create the document.");
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href; link.download = `${plan.article.title.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "destiny-infographic"}.docx`; link.click();
      URL.revokeObjectURL(href);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Destiny could not create the document."); }
    finally { setBusy(""); }
  }

  async function copyCard(id: string, copy: string) {
    await navigator.clipboard.writeText(copy);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(""), 1600);
  }

  return <div className="infographic-generator">
    <section className="infographic-intro workspace-card">
      <div><span className="feature-eyebrow">INFOGRAPHIC GENERATOR</span><h2>Turn one useful topic into a visual story.</h2><p>Destiny researches current evidence first. You review the facts before an image is created.</p></div>
      <ol className="infographic-steps" aria-label="Infographic creation steps"><li className={!plan ? "active" : "done"}><b>1</b><span>Research</span></li><li className={plan && !imageUrl ? "active" : imageUrl ? "done" : ""}><b>2</b><span>Review evidence</span></li><li className={imageUrl ? "done" : ""}><b>3</b><span>Create & export</span></li></ol>
    </section>
    <section className="infographic-deliverables" aria-label="What Destiny creates">
      <div><strong>One long infographic</strong><small>1024 × 3072 PNG</small></div><div><strong>Four reusable posts</strong><small>One from each story panel</small></div><div><strong>500–1,000-word article</strong><small>Sources preserved</small></div><div><strong>Google Docs-ready download</strong><small>Editable .docx file</small></div>
    </section>
    <section className="workspace-card infographic-setup">
      <div className="workspace-card-heading"><div><strong>Choose a keyword or enter your own topic</strong><small>Approved strategy topics are listed first.</small></div><span>{websiteName}</span></div>
      <div className="infographic-form-grid">
        <label><span>Topic</span><select value={topicChoice} onChange={(event) => setTopicChoice(event.target.value)}>{approvedKeywords.map((item) => <option key={item.keyword} value={`keyword:${item.keyword}`}>{item.keyword}{item.searchVolume > 0 ? ` · ${item.searchVolume.toLocaleString()} monthly searches` : ""}</option>)}<option value="custom">Enter my own topic</option></select></label>
        {topicChoice === "custom" && <label><span>Your topic</span><input value={customTopic} onChange={(event) => setCustomTopic(event.target.value)} placeholder="Example: employee background check trends" /></label>}
        <label><span>Visual direction</span><select value={style} onChange={(event) => setStyle(event.target.value as InfographicStyle)}>{INFOGRAPHIC_STYLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label} — {option.description}</option>)}</select></label>
        <label className="infographic-full"><span>Special instructions <small>Optional</small></span><textarea rows={3} value={specialInstructions} onChange={(event) => setSpecialInstructions(event.target.value)} placeholder="Mention an audience, industry, or point of view Destiny should consider." /></label>
      </div>
      {!generationAvailable && <div className="integration-banner warning" role="status"><strong>OpenAI image generation is not connected yet</strong><p>Add the server-side API key before creating an infographic. The key is never sent to the browser.</p></div>}
      {error && <div className="integration-banner warning" role="alert"><strong>Destiny needs your attention</strong><p>{error}</p></div>}
      <button className="primary-button" disabled={!generationAvailable || busy !== "" || !topic} onClick={research} type="button">{busy === "research" ? "Researching current sources…" : "Research current sources"}</button>
    </section>
    {plan && <section className="workspace-card infographic-evidence">
      <div className="workspace-card-heading"><div><strong>Review the evidence before creating</strong><small>{plan.sources.length} live sources support four story panels.</small></div><span>Nothing has been published</span></div>
      <div className="infographic-story-grid">{plan.sections.map((section, index) => <article key={section.id}><span>STORY {index + 1}</span><h3>{section.title}</h3><p>{section.takeaway}</p><div>{section.dataPoints.map((point) => <p key={`${point.value}-${point.label}`}><strong>{point.value}</strong> {point.label}<small>{point.context}</small></p>)}</div></article>)}</div>
      <div className="infographic-source-list"><h3>Source ledger</h3>{plan.sources.map((source) => <a href={source.url} key={source.id} rel="noreferrer" target="_blank"><span>{source.id}</span><strong>{source.title}</strong><small>{source.publisher} · {source.publishedAt}</small></a>)}</div>
      <div className="infographic-review-actions"><button className="primary-button" disabled={busy !== ""} onClick={createVisual} type="button">{busy === "visual" ? "Creating the visual…" : "Looks good — create infographic"}</button><button className="secondary-button" disabled={busy !== ""} onClick={research} type="button">Research again</button></div>
    </section>}
    {plan && <section className="infographic-output-grid">
      <div className="workspace-card infographic-preview"><div className="workspace-card-heading"><div><strong>Long infographic</strong><small>Exact claims and citations are rendered by Destiny.</small></div></div>{imageUrl ? <><Image alt={plan.altText} height={3072} src={imageUrl} unoptimized width={1024}/><a className="primary-button" download="destiny-infographic.png" href={imageUrl}>Download PNG</a></> : <div className="infographic-preview-empty"><b>Visual preview appears here</b><span>Create it after reviewing the evidence above.</span></div>}</div>
      <div className="workspace-card infographic-article"><div className="workspace-card-heading"><div><strong>Companion article</strong><small>{articleWords.toLocaleString()} words · editable export</small></div></div><h3>{plan.article.title}</h3><p><b>SEO/meta title:</b> {plan.article.metaTitle}</p><p><b>Meta description:</b> {plan.article.metaDescription}</p><details><summary>Preview article</summary><pre>{plan.article.markdown}</pre></details><button className="secondary-button" disabled={busy !== ""} onClick={downloadArticle} type="button">{busy === "document" ? "Preparing document…" : "Download Google Docs-ready article"}</button></div>
    </section>}
    {plan && <section className="workspace-card"><div className="workspace-card-heading"><div><strong>Four reusable posts</strong><small>Each keeps the sources from its matching story panel.</small></div></div><div className="infographic-repurpose-grid">{plan.repurposeCards.map((card) => <article key={card.id}><span>{card.recommendedChannel}</span><h3>{card.title}</h3><p>{card.copy}</p><button className="secondary-button" onClick={() => copyCard(card.id, card.copy)} type="button">{copiedId === card.id ? "Copied" : "Copy post"}</button></article>)}</div></section>}
  </div>;
}
