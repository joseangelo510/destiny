"use client";

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

export function KeywordStrategyReview({ auditId, initialDecisions, keywords, questId, questStatus }: {
  auditId: string;
  initialDecisions: Record<string, "approved" | "declined">;
  keywords: KeywordRecommendation[];
  questId?: string;
  questStatus?: string;
}) {
  const router = useRouter();
  const [decisions, setDecisions] = useState(initialDecisions);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const reviewed = keywords.filter((keyword) => decisions[keyword.keyword]).length;
  const themeCoverage = Object.values(keywords.reduce<Record<string, { label: string; count: number }>>((themes, keyword) => {
    const id = keyword.themeId || "evidence-based";
    const current = themes[id] ?? { label: keyword.themeLabel || "Evidence-based opportunity", count: 0 };
    themes[id] = { ...current, count: current.count + 1 };
    return themes;
  }, {})).sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));

  const decide = async (keyword: string, decision: "approved" | "declined") => {
    setSaving(keyword);
    setError("");
    const response = await fetch("/api/keywords/decisions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ auditId, keyword, decision }) });
    const payload = await response.json() as { error?: string };
    if (!response.ok) setError(payload.error || "Destiny could not save the keyword decision.");
    else setDecisions((current) => ({ ...current, [keyword]: decision }));
    setSaving("");
  };
  const finish = async () => {
    if (!questId || reviewed !== keywords.length) return;
    setSaving("quest");
    const response = await fetch(`/api/quests/${encodeURIComponent(questId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "complete" }) });
    const payload = await response.json() as { error?: string };
    if (!response.ok) setError(payload.error || "Destiny could not finish the keyword review.");
    else router.refresh();
    setSaving("");
  };
  const decideMany = async (decision: "approved" | "declined", candidates: KeywordRecommendation[]) => {
    if (!candidates.length) return;
    setSaving("batch");
    setError("");
    const response = await fetch("/api/keywords/decisions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ auditId, decisions: candidates.map((candidate) => ({ keyword: candidate.keyword, decision })) }) });
    const payload = await response.json() as { error?: string };
    if (!response.ok) setError(payload.error || "Destiny could not save the keyword decisions.");
    else setDecisions((current) => ({ ...current, ...Object.fromEntries(candidates.map((candidate) => [candidate.keyword, decision])) }));
    setSaving("");
  };

  const recommendedUnreviewed = keywords.slice(0, INITIAL_KEYWORD_APPROVAL_TARGET).filter((keyword) => !decisions[keyword.keyword]);
  const allUnreviewed = keywords.filter((keyword) => !decisions[keyword.keyword]);

  return <section className="workspace-card keyword-strategy-review">
    <div className="strategy-review-heading"><div><span className="eyebrow">Your decision</span><h2>Approve or decline the three-month opportunity pool</h2><p>Destiny has ranked up to 50 relevant searches so you have meaningful choices for the first 12 weeks. Buying and comparison intent lead; learning topics remain available when they support future authority.</p></div><div><strong>{reviewed} of {keywords.length}</strong><span>reviewed</span></div></div>
    <div className="strategy-theme-coverage"><div><strong>{themeCoverage.length} distinct search themes</strong><span>No single phrase family can consume the whole strategy.</span></div><div>{themeCoverage.map((theme) => <span key={theme.label}><b>{theme.label}</b><small>{theme.count} keyword{theme.count === 1 ? "" : "s"}</small></span>)}</div></div>
    <div className="keyword-bulk-actions"><div><strong>Faster review</strong><span>Start with the top {INITIAL_KEYWORD_APPROVAL_TARGET} opportunities needed to support a varied three-month plan, then adjust any individual choice.</span></div><button className="secondary-button" disabled={!recommendedUnreviewed.length || saving === "batch"} onClick={() => void decideMany("approved", recommendedUnreviewed)} type="button">Approve top {INITIAL_KEYWORD_APPROVAL_TARGET}</button><button className="decline-button" disabled={!allUnreviewed.length || saving === "batch"} onClick={() => void decideMany("declined", allUnreviewed)} type="button">Decline unreviewed</button></div>
    <div className="strategy-keyword-list">{keywords.map((keyword) => <article className={decisions[keyword.keyword] ?? "pending"} key={keyword.keyword}><div><div className="strategy-keyword-topline"><span className="strategy-keyword-label">{keyword.themeLabel || "Evidence-based opportunity"}</span><span className="strategy-keyword-source">{keyword.essential ? "Priority gap" : keyword.opportunity.replaceAll("_", " ")}</span><strong className={`intent-chip ${keyword.searchIntent}`}>{keyword.providerIntent}</strong><b>{keyword.priorityScore}/100 priority</b></div><h3>{keyword.keyword}</h3><p>{keyword.priorityReason}</p><small>{keyword.searchVolume.toLocaleString()} monthly searches · difficulty {keyword.difficulty} · advertisers pay ~${keyword.cpc.toFixed(2)}/click{keyword.rank > 0 ? ` · current rank #${keyword.rank}` : ""} · {keyword.competitorRankers} competitor rankers</small></div><div><button className={decisions[keyword.keyword] === "approved" ? "primary-button" : "secondary-button"} disabled={saving === keyword.keyword || saving === "batch"} onClick={() => void decide(keyword.keyword, "approved")} type="button">Approve</button><button className={decisions[keyword.keyword] === "declined" ? "decline-button active" : "decline-button"} disabled={saving === keyword.keyword || saving === "batch"} onClick={() => void decide(keyword.keyword, "declined")} type="button">Decline</button></div></article>)}</div>
    <div className="strategy-review-finish"><div><strong>What happens after approval?</strong><p>Approved keywords feed the 12-week editorial calendar, this week’s article drafts, and Rank Tracker automatically. Declined keywords stay out of the working plan; Destiny never silently removes a keyword you already chose to track.</p></div><button className="primary-button" disabled={!questId || reviewed !== keywords.length || saving === "quest" || questStatus === "complete"} onClick={() => void finish()} type="button">{questStatus === "complete" ? "Initial strategy reviewed" : saving === "quest" ? "Saving…" : "Finish keyword review"}</button></div>
    {error && <div className="error-banner">{error}</div>}
  </section>;
}
