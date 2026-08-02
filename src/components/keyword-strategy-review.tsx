"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type KeywordRecommendation = {
  keyword: string;
  searchVolume: number;
  difficulty: number;
  competitorRankers: number;
  opportunity: string;
  reason: string;
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

  return <section className="workspace-card keyword-strategy-review">
    <div className="strategy-review-heading"><div><span className="eyebrow">Your decision</span><h2>Approve or decline the initial keyword strategy</h2><p>Destiny already completed the research. Your job is to confirm which searches accurately represent the customers and work you want.</p></div><div><strong>{reviewed} of {keywords.length}</strong><span>reviewed</span></div></div>
    <div className="strategy-keyword-list">{keywords.map((keyword) => <article className={decisions[keyword.keyword] ?? "pending"} key={keyword.keyword}><div><span className="strategy-keyword-label">{keyword.essential ? "Priority gap" : keyword.opportunity.replaceAll("_", " ")}</span><h3>{keyword.keyword}</h3><p>{keyword.reason}</p><small>{keyword.searchVolume.toLocaleString()} monthly searches · difficulty {keyword.difficulty} · {keyword.competitorRankers} competitor rankers</small></div><div><button className={decisions[keyword.keyword] === "approved" ? "primary-button" : "secondary-button"} disabled={saving === keyword.keyword} onClick={() => void decide(keyword.keyword, "approved")} type="button">Approve</button><button className={decisions[keyword.keyword] === "declined" ? "decline-button active" : "decline-button"} disabled={saving === keyword.keyword} onClick={() => void decide(keyword.keyword, "declined")} type="button">Decline</button></div></article>)}</div>
    <div className="strategy-review-finish"><div><strong>What happens after approval?</strong><p>Approved keywords feed the six-month editorial calendar and this week’s three article drafts. Declined keywords stay out of the working plan.</p></div><button className="primary-button" disabled={!questId || reviewed !== keywords.length || saving === "quest" || questStatus === "complete"} onClick={() => void finish()} type="button">{questStatus === "complete" ? "Initial strategy reviewed" : saving === "quest" ? "Saving…" : "Finish keyword review"}</button></div>
    {error && <div className="error-banner">{error}</div>}
  </section>;
}
