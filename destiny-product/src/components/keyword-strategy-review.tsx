"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { INITIAL_KEYWORD_APPROVAL_TARGET } from "../lib/product/plan-horizon";

type KeywordRecommendation = {
  keyword: string;
  searchVolume: number;
  difficulty: number;
  competitorRankers: number;
  rank: number;
  cpc: number;
  opportunity: string;
  providerIntent: "transactional" | "commercial" | "navigational" | "informational";
  searchIntent: "conversion" | "consideration" | "awareness";
  priorityScore: number;
  priorityReason: string;
  themeId: string;
  themeLabel: string;
  themeRole: string;
  essential: boolean;
};

export function KeywordStrategyReview({ auditId, initialDecisions, keywords, questId, questStatus, websiteId }: {
  auditId: string;
  initialDecisions: Record<string, "approved" | "declined">;
  keywords: KeywordRecommendation[];
  questId?: string;
  questStatus?: string;
  websiteId?: string;
}) {
  const router = useRouter();
  const [decisions, setDecisions] = useState(initialDecisions);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const approved = keywords.filter((keyword) => decisions[keyword.keyword] === "approved").length;
  const declined = keywords.filter((keyword) => decisions[keyword.keyword] === "declined").length;
  const reviewed = approved + declined;
  const approvalsRemaining = Math.max(0, INITIAL_KEYWORD_APPROVAL_TARGET - approved);
  const canComplete = approved >= INITIAL_KEYWORD_APPROVAL_TARGET;
  const questComplete = questStatus === "complete";
  const siteQuery = websiteId ? `site=${encodeURIComponent(websiteId)}` : "";
  const findMoreHref = `/keyword-research?${siteQuery ? `${siteQuery}&` : ""}from=strategy`;
  const contentHref = `/content?${siteQuery ? `${siteQuery}&` : ""}strategy=complete`;
  const themeCoverage = Object.values(keywords.reduce<Record<string, { label: string; count: number }>>((themes, keyword) => {
    const id = keyword.themeId || "evidence-based";
    const current = themes[id] ?? { label: keyword.themeLabel || "Evidence-based opportunity", count: 0 };
    themes[id] = { ...current, count: current.count + 1 };
    return themes;
  }, {})).sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));

  const focusFirstUnreviewed = () => {
    const pending = document.querySelector<HTMLElement>(".strategy-keyword-list article.pending");
    pending?.scrollIntoView({ behavior: "smooth", block: "center" });
    pending?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
  };

  const decide = async (keyword: string, decision: "approved" | "declined") => {
    setSaving(keyword);
    setError("");
    try {
      const response = await fetch("/api/keywords/decisions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ auditId, keyword, decision }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) setError(payload.error || "Destiny could not save the keyword decision.");
      else setDecisions((current) => ({ ...current, [keyword]: decision }));
    } catch {
      setError("Destiny could not save the keyword decision. Check your connection and try again.");
    } finally {
      setSaving("");
    }
  };
  const finish = async () => {
    if (questComplete) {
      router.push(contentHref);
      return;
    }
    if (!questId) return;
    if (!canComplete) {
      setError(`Approve ${approvalsRemaining} more keyword${approvalsRemaining === 1 ? "" : "s"} to continue — at least ${INITIAL_KEYWORD_APPROVAL_TARGET} approvals unlock the 12-week content plan.`);
      focusFirstUnreviewed();
      return;
    }
    setSaving("quest");
    setError("");
    try {
      const response = await fetch(`/api/quests/${encodeURIComponent(questId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "complete" }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) setError(payload.error || "Destiny could not finish the keyword review.");
      else router.push(contentHref);
    } catch {
      setError("Destiny could not finish the keyword review. Check your connection and try again.");
    } finally {
      setSaving("");
    }
  };
  const decideMany = async (decision: "approved" | "declined", candidates: KeywordRecommendation[]) => {
    if (!candidates.length) return;
    setSaving("batch");
    setError("");
    try {
      const response = await fetch("/api/keywords/decisions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ auditId, decisions: candidates.map((candidate) => ({ keyword: candidate.keyword, decision })) }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) setError(payload.error || "Destiny could not save the keyword decisions.");
      else setDecisions((current) => ({ ...current, ...Object.fromEntries(candidates.map((candidate) => [candidate.keyword, decision])) }));
    } catch {
      setError("Destiny could not save the keyword decisions. Check your connection and try again.");
    } finally {
      setSaving("");
    }
  };

  const allUnreviewed = keywords.filter((keyword) => !decisions[keyword.keyword]);
  const nextApprovalCandidates = allUnreviewed.slice(0, approvalsRemaining);

  return <section className="workspace-card keyword-strategy-review">
    <div className="strategy-review-heading"><div><span className="eyebrow">Your decision</span><h2>Approve or decline the three-month opportunity pool</h2><p>Destiny shows up to 35 searches only when DataForSEO reports real monthly demand and the query matches what your business sells. Buying and comparison intent lead; learning topics remain available when they support future authority.</p></div><div className="strategy-approval-progress"><strong>{Math.min(approved, INITIAL_KEYWORD_APPROVAL_TARGET)} of {INITIAL_KEYWORD_APPROVAL_TARGET}</strong><span>approved</span><small>{reviewed} reviewed · {declined} declined</small></div></div>
    <p className="strategy-approval-note">You do not need to approve or review all {keywords.length} recommendations — approve at least {INITIAL_KEYWORD_APPROVAL_TARGET} that fit your business and finish. Unreviewed ideas remain available whenever you want them.</p>
    <div className="strategy-theme-coverage"><div><strong>{themeCoverage.length} distinct search themes</strong><span>No single phrase family can consume the whole strategy.</span></div><div>{themeCoverage.map((theme) => <span key={theme.label}><b>{theme.label}</b><small>{theme.count} keyword{theme.count === 1 ? "" : "s"}</small></span>)}</div></div>
    <div className="keyword-bulk-actions"><div><strong>Faster review</strong><span>Approve the next best unreviewed opportunities to reach {INITIAL_KEYWORD_APPROVAL_TARGET} approvals, then adjust any individual choice.</span></div>{nextApprovalCandidates.length > 0 && <button className="secondary-button" disabled={saving === "batch"} onClick={() => void decideMany("approved", nextApprovalCandidates)} type="button">Approve next {nextApprovalCandidates.length}</button>}<Link className="text-button" href={findMoreHref}>Find more keywords</Link></div>
    <div className="strategy-keyword-list">{keywords.map((keyword) => <article className={decisions[keyword.keyword] ?? "pending"} key={keyword.keyword}><div><div className="strategy-keyword-topline"><span className="strategy-keyword-label">{keyword.themeLabel || "Evidence-based opportunity"}</span><span className="strategy-keyword-source">{keyword.essential ? "Priority gap" : keyword.opportunity.replaceAll("_", " ")}</span><strong className={`intent-chip ${keyword.searchIntent}`}>{keyword.providerIntent}</strong><b>{keyword.priorityScore}/100 priority</b></div><h3>{keyword.keyword}</h3><p>{keyword.priorityReason}</p><small>{keyword.searchVolume.toLocaleString()} monthly searches · difficulty {keyword.difficulty} · advertisers pay ~${keyword.cpc.toFixed(2)}/click{keyword.rank > 0 ? ` · current rank #${keyword.rank}` : ""} · {keyword.competitorRankers} competitor rankers</small></div><div><button className={decisions[keyword.keyword] === "approved" ? "primary-button" : "secondary-button"} disabled={saving === keyword.keyword || saving === "batch"} onClick={() => void decide(keyword.keyword, "approved")} type="button">Approve</button><button className={decisions[keyword.keyword] === "declined" ? "decline-button active" : "decline-button"} disabled={saving === keyword.keyword || saving === "batch"} onClick={() => void decide(keyword.keyword, "declined")} type="button">Decline</button></div></article>)}</div>
    <div className="strategy-review-finish"><div><strong>What happens after approval?</strong><p>Approved keywords feed the 12-week editorial calendar, this week’s article drafts, and Rank Tracker automatically. Declined keywords stay out of the working plan; Destiny never silently removes a keyword you already chose to track. Want different ideas? <Link href={findMoreHref}>Find more keywords</Link> with live research — your saved decisions stay intact.</p></div><button aria-disabled={!questComplete && (!canComplete || !questId)} className="primary-button" disabled={saving === "quest"} onClick={() => void finish()} type="button">{questComplete ? "Open my 12-week content plan" : saving === "quest" ? "Saving…" : canComplete ? "Build my 12-week content plan" : `Approve ${approvalsRemaining} more to continue`}</button></div>
    {error && <div className="error-banner" role="alert">{error}</div>}
  </section>;
}
