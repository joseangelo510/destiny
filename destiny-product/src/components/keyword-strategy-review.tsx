"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useRef, useState } from "react";
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

type KeywordTab = "review" | "approved" | "declined";
type KeywordDecision = "approved" | "declined";
type KeywordReason = "wrong_audience" | "not_offered" | "too_competitive" | "already_covered" | "not_now";

const REASON_LABELS: Record<KeywordReason, string> = {
  wrong_audience: "Wrong audience",
  not_offered: "Not a service we offer",
  too_competitive: "Too competitive",
  already_covered: "Already covered",
  not_now: "Not now",
};

type NextAction = {
  code: "review_keywords" | "create_first_article" | "review_weekly_content" | "track_progress";
  href: string;
  label: string;
  description: string;
};

export function KeywordStrategyReview({ auditHref, auditId, initialDecisions, initialReasons, initialTab, keywords, moreKeywordsHref, nextAction, nextHref, questId, questStatus }: {
  auditHref?: string;
  auditId: string;
  initialDecisions: Record<string, KeywordDecision>;
  initialReasons: Record<string, string | null>;
  initialTab: KeywordTab;
  keywords: KeywordRecommendation[];
  moreKeywordsHref: string;
  nextAction: NextAction;
  nextHref: string;
  questId?: string;
  questStatus?: string;
}) {
  const router = useRouter();
  const firstUnreviewedRef = useRef<HTMLTableRowElement | null>(null);
  const [activeTab, setActiveTab] = useState<KeywordTab>(initialTab);
  const [decisions, setDecisions] = useState(initialDecisions);
  const [reasons, setReasons] = useState(initialReasons);
  const [pendingDecline, setPendingDecline] = useState("");
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [showAll, setShowAll] = useState(false);

  const approvedKeywords = keywords.filter((keyword) => decisions[keyword.keyword] === "approved");
  const declinedKeywords = keywords.filter((keyword) => decisions[keyword.keyword] === "declined");
  const reviewKeywords = keywords.filter((keyword) => !decisions[keyword.keyword]);
  const approved = approvedKeywords.length;
  const declined = declinedKeywords.length;
  const firstUnreviewedKeyword = reviewKeywords[0]?.keyword;
  const approvalsRemaining = Math.max(0, INITIAL_KEYWORD_APPROVAL_TARGET - approved);
  const canComplete = approvalsRemaining === 0;
  const strategyComplete = questStatus === "complete" && canComplete;
  const recommendedUnreviewed = reviewKeywords.slice(0, approvalsRemaining);
  const visibleKeywords = activeTab === "approved" ? approvedKeywords : activeTab === "declined" ? declinedKeywords : reviewKeywords;
  const displayedKeywords = showAll ? visibleKeywords : visibleKeywords.slice(0, 10);

  const selectTab = (tab: KeywordTab) => {
    setActiveTab(tab);
    setShowAll(false);
    setPendingDecline("");
  };

  const themeCoverage = Object.values(keywords.reduce<Record<string, { label: string; count: number }>>((themes, keyword) => {
    const id = keyword.themeId || "evidence-based";
    const current = themes[id] ?? { label: keyword.themeLabel || "Evidence-based opportunity", count: 0 };
    themes[id] = { ...current, count: current.count + 1 };
    return themes;
  }, {})).sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));

  const saveDecision = async (keyword: string, decision: KeywordDecision, reason: KeywordReason | null = null) => {
    setSaving(keyword);
    setError("");
    setStatus("");
    try {
      const response = await fetch("/api/keywords/decisions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ auditId, keyword, decision, reason }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Destiny could not save the keyword decision.");
      setDecisions((current) => ({ ...current, [keyword]: decision }));
      setReasons((current) => ({ ...current, [keyword]: reason }));
      setPendingDecline("");
      setStatus(decision === "approved"
        ? `Approved “${keyword}.” It now supports your three-month plan and weekly rank tracking.`
        : `Moved “${keyword}” to Declined. Destiny will use this feedback when shaping future recommendations.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Destiny could not save the keyword decision.");
    } finally {
      setSaving("");
    }
  };

  const restoreToReview = async (keyword: string) => {
    setSaving(keyword);
    setError("");
    setStatus("");
    try {
      const response = await fetch("/api/keywords/decisions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ auditId, keyword, action: "restore" }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Destiny could not restore this keyword.");
      setDecisions((current) => {
        const next = { ...current };
        delete next[keyword];
        return next;
      });
      setReasons((current) => {
        const next = { ...current };
        delete next[keyword];
        return next;
      });
      setActiveTab("review");
      setStatus(`“${keyword}” is back in To Review. Existing drafts and rank history were kept.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Destiny could not restore this keyword.");
    } finally {
      setSaving("");
    }
  };

  const finish = async () => {
    setError("");
    if (strategyComplete) {
      router.push(nextAction.href);
      return;
    }
    if (!canComplete) {
      setError(`Approve ${approvalsRemaining} more keyword${approvalsRemaining === 1 ? "" : "s"} to continue. You do not need to review all ${keywords.length}.`);
      setActiveTab("review");
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

  const approveMany = async (candidates: KeywordRecommendation[]) => {
    if (!candidates.length) return;
    setSaving("batch");
    setError("");
    setStatus("");
    try {
      const response = await fetch("/api/keywords/decisions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ auditId, decisions: candidates.map((candidate) => ({ keyword: candidate.keyword, decision: "approved" })) }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Destiny could not save the keyword decisions.");
      setDecisions((current) => ({ ...current, ...Object.fromEntries(candidates.map((candidate) => [candidate.keyword, "approved"])) }));
      setStatus(`${candidates.length} recommended keyword${candidates.length === 1 ? "" : "s"} approved. You can review or change every choice from Approved.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Destiny could not save the keyword decisions.");
    } finally {
      setSaving("");
    }
  };

  return <section className="keyword-strategy-review" id="keyword-strategy-review">
    {strategyComplete ? <section aria-label="Strategy summary" className="claude-ks-summary">
      <div className={`claude-ks-stat ${reviewKeywords.length === 0 ? "zero" : ""}`}><strong>{reviewKeywords.length}</strong><span>To review</span><small>{reviewKeywords.length === 0 ? "You’re all caught up" : "Ready when you are"}</small></div>
      <div className="claude-ks-stat"><strong>{approved}</strong><span>Approved</span><small>In your 12-week calendar</small></div>
      <div className="claude-ks-stat"><strong>{declined}</strong><span>Declined</span><small>Saved · restorable anytime</small></div>
      <div className="claude-ks-next-step"><div><small>Next step</small><strong>{nextAction.code === "create_first_article" && approvedKeywords[0] ? <>Your first article is ready to plan: <em>{approvedKeywords[0].keyword}</em>.</> : nextAction.description}</strong></div><Link href={nextAction.href}>{nextAction.label}</Link></div>
    </section> : <section className="claude-ks-decision-heading">
      <div><span className="eyebrow">Your decision</span><h2>Choose at least five keywords for your first plan</h2><p>Approve the searches that fit the business. You do not need to approve or review all {keywords.length}; unreviewed ideas stay available for later.</p></div>
      <div><strong>{approved} of {INITIAL_KEYWORD_APPROVAL_TARGET}</strong><span>approved</span></div>
    </section>}

    <div aria-label="Keyword decision lists" className="claude-ks-tabs" id="keyword-strategy-tabs" role="tablist">
      <button aria-selected={activeTab === "review"} className={activeTab === "review" ? "active" : ""} onClick={() => selectTab("review")} role="tab" type="button">To Review <span>{reviewKeywords.length}</span></button>
      <button aria-selected={activeTab === "approved"} className={activeTab === "approved" ? "active" : ""} onClick={() => selectTab("approved")} role="tab" type="button">Approved <span>{approved}</span></button>
      <button aria-selected={activeTab === "declined"} className={activeTab === "declined" ? "active" : ""} onClick={() => selectTab("declined")} role="tab" type="button">Declined <span>{declined}</span></button>
    </div>

    {activeTab === "review" && reviewKeywords.length > 0 ? <div className="claude-ks-review-context">
      <div><strong>{themeCoverage.length} distinct search themes</strong><span>No single phrase family can consume the whole strategy.</span></div>
      <div className="claude-ks-review-actions">{!canComplete && <button disabled={!recommendedUnreviewed.length || saving === "batch"} onClick={() => void approveMany(recommendedUnreviewed)} type="button">Approve next {approvalsRemaining}</button>}<Link href={moreKeywordsHref}>Find more keywords</Link></div>
    </div> : null}

    {status && <div aria-live="polite" className="integration-banner success keyword-decision-status" role="status"><strong>Decision saved</strong><p>{status}</p></div>}

    {!visibleKeywords.length ? <section className="claude-ks-panel" role="tabpanel"><div className="claude-ks-empty"><span aria-hidden="true">✓</span><h3>{activeTab === "review" ? "You’re all caught up" : activeTab === "approved" ? "No approved keywords yet" : "No declined keywords"}</h3><p>{activeTab === "review" ? "Every recommendation from your last audit has been reviewed. New keyword ideas arrive with your next audit." : activeTab === "approved" ? "Approve relevant searches from To Review to build the working plan." : "Keywords you decline remain here with their reason, ready to restore anytime."}</p><div>{activeTab !== "review" && <button onClick={() => selectTab("review")} type="button">Open To Review</button>}{activeTab === "review" && auditHref ? <Link href={auditHref}>Run a new audit</Link> : null}{!auditHref && activeTab === "review" ? <Link href={moreKeywordsHref}>Find more keywords</Link> : null}</div></div></section> : <section className="claude-ks-panel" role="tabpanel">
      <div className="claude-ks-table-scroll"><table><thead><tr><th>Keyword</th><th>Intent</th><th>Monthly searches</th><th>Opportunity</th><th>Plan status</th><th>Action</th></tr></thead><tbody>{displayedKeywords.map((keyword) => {
        const decision = decisions[keyword.keyword];
        const reason = reasons[keyword.keyword];
        const opportunityLabel = keyword.priorityScore >= 70 ? "High" : keyword.priorityScore >= 50 ? "Good" : "Fair";
        const opportunityWidth = `${Math.max(12, Math.min(100, keyword.priorityScore))}%`;
        const intentLabel = keyword.providerIntent.charAt(0).toUpperCase() + keyword.providerIntent.slice(1);
        return <Fragment key={keyword.keyword}><tr className={decision ?? "pending"} ref={keyword.keyword === firstUnreviewedKeyword ? firstUnreviewedRef : undefined} tabIndex={keyword.keyword === firstUnreviewedKeyword ? -1 : undefined}>
          <td className="claude-ks-keyword"><strong>{keyword.keyword}</strong><small>{keyword.priorityReason}</small></td>
          <td><span className={`claude-ks-intent ${keyword.providerIntent}`}>{intentLabel}</span></td>
          <td className="claude-ks-number">{keyword.searchVolume.toLocaleString()}</td>
          <td><div className="claude-ks-opportunity" title={`${keyword.priorityScore} out of 100`}><span><i style={{ width: opportunityWidth }} /></span><b>{opportunityLabel}</b></div></td>
          <td className="claude-ks-plan-status">{decision === "approved" ? <><strong>In three-month plan</strong> · Tracking rank weekly</> : decision === "declined" ? <><strong>{reason && reason in REASON_LABELS ? REASON_LABELS[reason as KeywordReason] : "Saved feedback"}</strong> · Restorable</> : <><strong>Ready to decide</strong></>}</td>
          <td className="claude-ks-row-actions">{activeTab === "review" ? <><button disabled={saving === keyword.keyword || saving === "batch"} onClick={() => void saveDecision(keyword.keyword, "approved")} type="button">Approve</button><button disabled={saving === keyword.keyword || saving === "batch"} onClick={() => setPendingDecline(keyword.keyword)} type="button">Decline</button></> : <button disabled={saving === keyword.keyword} onClick={() => void restoreToReview(keyword.keyword)} type="button">{activeTab === "declined" ? "Restore to review" : "Unapprove"}</button>}</td>
        </tr>{pendingDecline === keyword.keyword ? <tr><td className="claude-ks-decline" colSpan={6}><strong>Why decline? <small>Optional</small></strong><div>{(Object.keys(REASON_LABELS) as KeywordReason[]).map((code) => <button disabled={saving === keyword.keyword} key={code} onClick={() => void saveDecision(keyword.keyword, "declined", code)} type="button">{REASON_LABELS[code]}</button>)}</div><button disabled={saving === keyword.keyword} onClick={() => void saveDecision(keyword.keyword, "declined")} type="button">Decline without a reason</button><button onClick={() => setPendingDecline("")} type="button">Cancel</button></td></tr> : null}</Fragment>;
      })}</tbody></table></div>
      <footer className="claude-ks-table-foot"><span>Showing {displayedKeywords.length} of {visibleKeywords.length} {activeTab === "review" ? "keywords to review" : `${activeTab} keywords`}{activeTab === "declined" ? " · Restoring sends a keyword back to To Review" : ""}</span>{visibleKeywords.length > 10 ? <button onClick={() => setShowAll((current) => !current)} type="button">{showAll ? "Show first 10" : `View all ${visibleKeywords.length}`} <span aria-hidden="true">→</span></button> : null}</footer>
    </section>}

    {!strategyComplete ? <div className="claude-ks-finish"><div><strong>{canComplete ? "Ready to build your three-month content plan" : `Approve ${approvalsRemaining} more to continue`}</strong><p>{canComplete ? "Your approved keywords will feed the three-month editorial calendar, this week’s article drafts, and Rank Tracker." : `Approve ${INITIAL_KEYWORD_APPROVAL_TARGET} total. You do not need to decide all ${keywords.length}; decline only the searches that do not fit.`}</p></div><button aria-disabled={!canComplete || !questId} disabled={saving === "quest"} onClick={() => void finish()} type="button">{saving === "quest" ? "Building your plan…" : canComplete ? "Build my three-month content plan" : `Approve ${approvalsRemaining} more to continue`}</button></div> : null}
    {error && <div aria-live="polite" className="error-banner">{error}</div>}
  </section>;
}
