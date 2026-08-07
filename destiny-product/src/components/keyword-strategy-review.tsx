"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
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

export function KeywordStrategyReview({ auditId, initialDecisions, keywords, moreKeywordsHref, nextHref, questId, questStatus }: {
  auditId: string;
  initialDecisions: Record<string, "approved" | "declined">;
  keywords: KeywordRecommendation[];
  moreKeywordsHref: string;
  nextHref: string;
  questId?: string;
  questStatus?: string;
}) {
  const router = useRouter();
  const firstUnreviewedRef = useRef<HTMLElement | null>(null);
  const [decisions, setDecisions] = useState(initialDecisions);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const approved = keywords.filter((keyword) => decisions[keyword.keyword] === "approved").length;
  const declined = keywords.filter((keyword) => decisions[keyword.keyword] === "declined").length;
  const reviewed = approved + declined;
  const allUnreviewed = keywords.filter((keyword) => !decisions[keyword.keyword]);
  const firstUnreviewedKeyword = allUnreviewed[0]?.keyword;
  const approvalsRemaining = Math.max(0, INITIAL_KEYWORD_APPROVAL_TARGET - approved);
  const canComplete = approvalsRemaining === 0;
  const recommendedUnreviewed = allUnreviewed.slice(0, approvalsRemaining);
  const themeCoverage = Object.values(keywords.reduce<Record<string, { label: string; count: number }>>((themes, keyword) => {
    const id = keyword.themeId || "evidence-based";
    const current = themes[id] ?? { label: keyword.themeLabel || "Evidence-based opportunity", count: 0 };
    themes[id] = { ...current, count: current.count + 1 };
    return themes;
  }, {})).sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));

  const decide = async (keyword: string, decision: "approved" | "declined") => {
    setSaving(keyword);
    setError("");
    try {
      const response = await fetch("/api/keywords/decisions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ auditId, keyword, decision }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Destiny could not save the keyword decision.");
      setDecisions((current) => ({ ...current, [keyword]: decision }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Destiny could not save the keyword decision.");
    } finally {
      setSaving("");
    }
  };

  const finish = async () => {
    setError("");
    if (questStatus === "complete") {
      router.push(nextHref);
      return;
    }
    if (!canComplete) {
      setError(`Approve ${approvalsRemaining} more keyword${approvalsRemaining === 1 ? "" : "s"} to continue. You do not need to review all ${keywords.length}.`);
      firstUnreviewedRef.current?.focus();
      firstUnreviewedRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!questId) {
      setError("Destiny could not find the keyword review task. Refresh the page and try again.");
      return;
    }
    setSaving("quest");
    try {
      const response = await fetch(`/api/quests/${encodeURIComponent(questId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "complete" }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Destiny could not finish the keyword review.");
      router.push(nextHref);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Destiny could not finish the keyword review.");
    } finally {
      setSaving("");
    }
  };

  const decideMany = async (candidates: KeywordRecommendation[]) => {
    if (!candidates.length) return;
    setSaving("batch");
    setError("");
    try {
      const response = await fetch("/api/keywords/decisions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ auditId, decisions: candidates.map((candidate) => ({ keyword: candidate.keyword, decision: "approved" })) }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Destiny could not save the keyword decisions.");
      setDecisions((current) => ({ ...current, ...Object.fromEntries(candidates.map((candidate) => [candidate.keyword, "approved"])) }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Destiny could not save the keyword decisions.");
    } finally {
      setSaving("");
    }
  };

  return <section className="workspace-card keyword-strategy-review" id="keyword-strategy-review">
    <div className="strategy-review-heading"><div><span className="eyebrow">Your decision</span><h2>Choose at least five keywords for your first plan</h2><p>Approve the searches that fit the business. You do not need to approve or review all {keywords.length}; unreviewed ideas stay available for later.</p></div><div><strong>{approved} of {INITIAL_KEYWORD_APPROVAL_TARGET}</strong><span>approved</span></div></div>
    <div className="strategy-theme-coverage"><div><strong>{themeCoverage.length} distinct search themes</strong><span>No single phrase family can consume the whole strategy.</span></div><div>{themeCoverage.map((theme) => <span key={theme.label}><b>{theme.label}</b><small>{theme.count} keyword{theme.count === 1 ? "" : "s"}</small></span>)}</div></div>
    <div className="keyword-bulk-actions"><div><strong>{canComplete ? "Your first plan is ready" : "Get to five faster"}</strong><span>{canComplete ? `You can continue now, approve more, or explore alternatives. ${reviewed} of ${keywords.length} recommendations reviewed.` : `Approve ${approvalsRemaining} more recommended keyword${approvalsRemaining === 1 ? "" : "s"} in one step, then adjust any individual choice.`}</span></div>{!canComplete && <button className="secondary-button" disabled={!recommendedUnreviewed.length || saving === "batch"} onClick={() => void decideMany(recommendedUnreviewed)} type="button">Approve next {approvalsRemaining}</button>}<Link className="secondary-button" href={moreKeywordsHref}>Find more keywords</Link></div>
    <div className="strategy-keyword-list">{keywords.map((keyword) => <article className={decisions[keyword.keyword] ?? "pending"} key={keyword.keyword} ref={keyword.keyword === firstUnreviewedKeyword ? firstUnreviewedRef : undefined} tabIndex={keyword.keyword === firstUnreviewedKeyword ? -1 : undefined}><div><div className="strategy-keyword-topline"><span className="strategy-keyword-label">{keyword.themeLabel || "Evidence-based opportunity"}</span><span className="strategy-keyword-source">{keyword.essential ? "Priority gap" : keyword.opportunity.replaceAll("_", " ")}</span><strong className={`intent-chip ${keyword.searchIntent}`}>{keyword.providerIntent}</strong><b>{keyword.priorityScore}/100 priority</b></div><h3>{keyword.keyword}</h3><p>{keyword.priorityReason}</p><small>{keyword.searchVolume.toLocaleString()} monthly searches · difficulty {keyword.difficulty} · advertisers pay ~${keyword.cpc.toFixed(2)}/click{keyword.rank > 0 ? ` · current rank #${keyword.rank}` : ""} · {keyword.competitorRankers} competitor rankers</small></div><div><button className={decisions[keyword.keyword] === "approved" ? "primary-button" : "secondary-button"} disabled={saving === keyword.keyword || saving === "batch"} onClick={() => void decide(keyword.keyword, "approved")} type="button">Approve</button><button className={decisions[keyword.keyword] === "declined" ? "decline-button active" : "decline-button"} disabled={saving === keyword.keyword || saving === "batch"} onClick={() => void decide(keyword.keyword, "declined")} type="button">Decline</button></div></article>)}</div>
    <div className="strategy-review-finish"><div><strong>{canComplete ? "Ready to build your content plan" : `Approve ${approvalsRemaining} more to continue`}</strong><p>{canComplete ? "Your approved keywords will feed the 12-week editorial calendar, this week’s article drafts, and Rank Tracker." : `Approve ${INITIAL_KEYWORD_APPROVAL_TARGET} total. You do not need to decide all ${keywords.length}; decline only the searches that do not fit.`}</p></div><button aria-disabled={!canComplete || !questId} className="primary-button" disabled={saving === "quest"} onClick={() => void finish()} type="button">{questStatus === "complete" ? "Open your content plan" : saving === "quest" ? "Opening your content plan…" : canComplete ? "Build my 12-week content plan" : `Approve ${approvalsRemaining} more to continue`}</button></div>
    {error && <div aria-live="polite" className="error-banner">{error}</div>}
  </section>;
}
