import Link from "next/link";
import { notFound } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { WorkspaceShell } from "@/components/workspace-shell";
import type { ReoptimizationManifest } from "@/lib/seo/reoptimization-document";
import { requireWorkspaceClient } from "@/lib/workspace-context";
import styles from "./reoptimization.module.css";

const heading = (level: string | null, text: string) => level && text ? `${level} — ${text}` : "—";

export default async function ReoptimizationDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, userId } = await requireWorkspaceClient();
  const { data } = await (supabase as unknown as SupabaseClient).from("reoptimization_documents").select("manifest,user_id,website_id").eq("id", id).maybeSingle();
  if (!data || data.user_id !== userId) notFound();
  const stored = data.manifest as Partial<ReoptimizationManifest>;
  if (stored.version !== 4 || !stored.strategy || !stored.research) return <WorkspaceShell active="/keywords" eyebrow="Re-optimization document" title="This plan needs fresh research" description="Return to Keyword Strategy and regenerate this document to use Rebound SEO's simplified heading and keyword framework."><div className={styles.warning}><strong>Outdated draft blocked</strong><p>No recommendation from the older document should be applied.</p></div><div className={styles.actions}><Link href={`/keywords?site=${data.website_id}`}>← Regenerate from keyword strategy</Link></div></WorkspaceShell>;
  const manifest = stored as ReoptimizationManifest;
  const titleItem = manifest.strategy.checklist.find((item) => item.id === "snippet");
  const currentTitle = manifest.research.currentPage.title || "No verified page title";
  const recommendedTitle = titleItem?.status === "opportunity" && titleItem.recommended !== "No replacement proposed."
    ? titleItem.recommended
    : "Keep the current title unless the final heading plan requires a matching update.";
  const otherChanges = manifest.changes.filter((change) => !["structure", "query-coverage", "snippet"].includes(change.id));

  return <WorkspaceShell active="/keywords" eyebrow="Re-optimization document" title={`Improve “${manifest.keyword}”`} description="Copy-ready changes in page order. Rebound SEO never publishes these edits without your review.">
    <div className={styles.actions}><Link href={`/keywords?site=${data.website_id}`}>← Back to keyword strategy</Link><a className={styles.download} href={`/api/reoptimization-documents/${id}/download`}>Download editable Word document</a></div>
    {manifest.warning ? <div className={styles.warning}><strong>Verify before editing</strong><p>{manifest.warning}</p></div> : null}
    <section className={styles.hero}><div><span>Target page</span><a href={manifest.pageUrl} rel="noreferrer" target="_blank">{manifest.pageUrl}</a></div><p>{manifest.strategy.summary}</p></section>
    <section className={styles.simpleSection}><h2>1. Page title</h2><p>Review the title before working on the rest of the page.</p><div className={styles.simpleComparison}><article><strong>Before</strong><p>{currentTitle}</p></article><article><strong>After</strong><p>{recommendedTitle}</p></article></div></section>
    <section className={styles.simpleSection}><h2>2. Headings</h2><p>Follow the action in the first column. The hierarchy uses primary, secondary, and related phrases only where they accurately describe the section.</p><div className={styles.keywordMap}><strong>Keyword coverage</strong><p><b>Primary</b> — {manifest.strategy.keywordFramework.primary}</p><p><b>Secondary</b> — {manifest.strategy.keywordFramework.secondary.join(", ") || "No additional evidence-backed commercial variant"}</p><p><b>Related</b> — {manifest.strategy.keywordFramework.related.join(", ") || "No additional evidence-backed related phrase"}</p></div><div className={styles.tableWrap}><table className={styles.headingTable}><thead><tr><th>Action</th><th>Existing heading</th><th>Recommended heading</th></tr></thead><tbody>{manifest.strategy.headingDecisions.map((decision, index) => <tr key={`${decision.action}-${decision.existingText}-${index}`}><td><strong>{decision.action}</strong></td><td>{heading(decision.existingLevel, decision.existingText)}</td><td>{decision.action === "remove" ? decision.rationale : heading(decision.recommendedLevel, decision.recommendedText)}</td></tr>)}</tbody></table></div></section>
    <section className={styles.simpleSection}><h2>3. Other page changes</h2><p>These are the remaining evidence-backed changes that are not heading edits.</p><div className={styles.simpleChanges}>{otherChanges.length ? otherChanges.map((change) => <article key={change.id}><h3>{change.element}</h3><p><strong>Before:</strong> {change.current}</p><p><strong>After:</strong> {change.recommended}</p><p><strong>Why:</strong> {change.why}</p></article>) : <p>No additional page changes are justified yet.</p>}</div></section>
    <section className={styles.nextStep}><h2>4. Your next step</h2><p>Begin with Section 1, then complete the heading table in page order. Review every claim before changing the CMS; Rebound SEO does not publish automatically.</p></section>
  </WorkspaceShell>;
}
