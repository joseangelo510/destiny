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
  const firstUnreviewedRef = useRef<HTMLElement | null>(null);
  const [activeTab, setActiveTab] = useState<KeywordTab>(initialTab);
  const [decisions, setDecisions] = useState(initialDecisions);
  const [reasons, setReasons] = useState(initialReasons);
  const [pendingDecline, setPendingDecline] = useState("");
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const approvedKeywords = keywords.filter((keyword) => decisions[keyword.keyword] === "approved");
  const declinedKeywords = keywords.filter((keyword) => decisions[keyword.keyword] === "declined");
  const reviewKeywords = keywords.filter((keyword) => !decisions[keyword.keyword]);
  const approved = approvedKeywords.length;
  const declined = declinedKeywords.length;
  const reviewed = approved + declined;
  const firstUnreviewedKeyword = reviewKeywords[0]?.keyword;
  const approvalsRemaining = Math.max(0, INITIAL_KEYWORD_APPROVAL_TARGET - approved);
  const canComplete = approvalsRemaining === 0;
  const strategyComplete = questStatus === "complete" && canComplete;
  const recommendedUnreviewed = reviewKeywords.slice(0, approvalsRemaining);
  const visibleKeywords = activeTab === "approved" ? approvedKeywords : activeTab === "declined" ? declinedKeywords : reviewKeywords;

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

  return <section className="workspace-card keyword-strategy-review" id="keyword-strategy-review">
    {strategyComplete ? <div className="keyword-strategy-ready">
      <div><span className="eyebrow">Strategy saved</span><h2>Your keyword strategy is ready</h2><p>Destiny remembers these choices for this website and uses them to keep the content plan focused.</p></div>
      <div className="keyword-strategy-stats"><span><strong>{approved}</strong> approved</span><span><strong>{declined}</strong> declined</span><span><strong>{reviewKeywords.length}</strong> to review</span></div>
      <div className="keyword-strategy-powered"><span>✓ Three-month editorial calendar</span><span>✓ Weekly content assignments</span><span>✓ Weekly rank tracking</span></div>
      <div className="keyword-next-action"><div><small>YOUR NEXT STEP</small><strong>{nextAction.label}</strong><p>{nextAction.description}</p></div><Link className="primary-button" href={nextAction.href}>{nextAction.label}</Link></div>
    </div> : <div className="strategy-review-heading"><div><span className="eyebrow">Your decision</span><h2>Choose at least five keywords for your first plan</h2><p>Approve the searches that fit the business. You do not need to approve or review all {keywords.length}; unreviewed ideas stay available for later.</p></div><div><strong>{approved} of {INITIAL_KEYWORD_APPROVAL_TARGET}</strong><span>approved</span></div></div>}

    <div aria-label="Keyword decision lists" className="keyword-strategy-tabs" id="keyword-strategy-tabs" role="tablist">
      <button aria-selected={activeTab === "review"} className={activeTab === "review" ? "active" : ""} onClick={() => setActiveTab("review")} role="tab" type="button">To Review <span>{reviewKeywords.length}</span></button>
      <button aria-selected={activeTab === "approved"} className={activeTab === "approved" ? "active" : ""} onClick={() => setActiveTab("approved")} role="tab" type="button">Approved <span>{approved}</span></button>
      <button aria-selected={activeTab === "declined"} className={activeTab === "declined" ? "active" : ""} onClick={() => setActiveTab("declined")} role="tab" type="button">Declined <span>{declined}</span></button>
    </div>

    {activeTab === "review" && reviewKeywords.length > 0 ? <>
      <div className="strategy-theme-coverage"><div><strong>{themeCoverage.length} distinct search themes</strong><span>No single phrase family can consume the whole strategy.</span></div><div>{themeCoverage.map((theme) => <span key={theme.label}><b>{theme.label}</b><small>{theme.count} keyword{theme.count === 1 ? "" : "s"}</small></span>)}</div></div>
      <div className="keyword-bulk-actions"><div><strong>{canComplete ? "Your first plan is ready" : "Get to five faster"}</strong><span>{canComplete ? `You can continue now, approve more, or explore alternatives. ${reviewed} of ${keywords.length} recommendations reviewed.` : `Approve ${approvalsRemaining} more recommended keyword${approvalsRemaining === 1 ? "" : "s"} in one step, then adjust any choice from Approved.`}</span></div>{!canComplete && <button className="secondary-button" disabled={!recommendedUnreviewed.length || saving === "batch"} onClick={() => void approveMany(recommendedUnreviewed)} type="button">Approve next {approvalsRemaining}</button>}<Link className="secondary-button" href={moreKeywordsHref}>Find more keywords</Link></div>
    </> : null}

    {status && <div aria-live="polite" className="integration-banner success keyword-decision-status" role="status"><strong>Decision saved</strong><p>{status}</p></div>}

    {!visibleKeywords.length ? <div className="keyword-tab-empty"><span>✓</span><h3>{activeTab === "review" ? "You’re all caught up" : activeTab === "approved" ? "No approved keywords yet" : "No declined keywords"}</h3><p>{activeTab === "review" ? "New recommendations arrive when Destiny completes fresh keyword research. Your saved choices remain available in Approved and Declined." : activeTab === "approved" ? "Approve relevant searches from To Review to build the working plan." : "Keywords you decline will remain here with their reason, ready to restore anytime."}</p><div>{activeTab !== "review" && <button className="secondary-button" onClick={() => setActiveTab("review")} type="button">Open To Review</button>}{activeTab === "review" && auditHref ? <Link className="secondary-button" href={auditHref}>Run a new audit</Link> : null}<Link className="secondary-button" href={moreKeywordsHref}>Find more keywords</Link></div></div> : <div className="strategy-keyword-list" role="tabpanel">{visibleKeywords.map((keyword) => {
      const decision = decisions[keyword.keyword];
      const reason = reasons[keyword.keyword];
      return <article className={decision ?? "pending"} key={keyword.keyword} ref={keyword.keyword === firstUnreviewedKeyword ? firstUnreviewedRef : undefined} tabIndex={keyword.keyword === firstUnreviewedKeyword ? -1 : undefined}>
        <div><div className="strategy-keyword-topline"><span className="strategy-keyword-label">{keyword.themeLabel || "Evidence-based opportunity"}</span><span className="strategy-keyword-source">{keyword.essential ? "Priority gap" : keyword.opportunity.replaceAll("_", " ")}</span><strong className={`intent-chip ${keyword.searchIntent}`}>{keyword.providerIntent}</strong><b>{keyword.priorityScore}/100 priority</b></div><h3>{keyword.keyword}</h3><p>{keyword.priorityReason}</p><small>{keyword.searchVolume.toLocaleString()} monthly searches · difficulty {keyword.difficulty} · advertisers pay ~${keyword.cpc.toFixed(2)}/click{keyword.rank > 0 ? ` · current rank #${keyword.rank}` : ""} · {keyword.competitorRankers} competitor rankers</small>
          {decision === "approved" ? <div className="keyword-working-status"><strong>In three-month plan · Tracking rank weekly</strong><span>Moving this back to review removes it from the active calendar but keeps existing drafts and rank history.</span></div> : null}
          {decision === "declined" ? <div className="keyword-working-status declined"><strong>{reason && reason in REASON_LABELS ? REASON_LABELS[reason as KeywordReason] : "No reason added"}</strong><span>Destiny keeps this feedback for future recommendations. You can restore the keyword anytime.</span></div> : null}
          {pendingDecline === keyword.keyword ? <div className="keyword-decline-reasons"><strong>Why decline? <small>Optional</small></strong><div>{(Object.keys(REASON_LABELS) as KeywordReason[]).map((code) => <button disabled={saving === keyword.keyword} key={code} onClick={() => void saveDecision(keyword.keyword, "declined", code)} type="button">{REASON_LABELS[code]}</button>)}</div><button className="text-button" disabled={saving === keyword.keyword} onClick={() => void saveDecision(keyword.keyword, "declined")} type="button">Decline without a reason</button><button className="text-button" onClick={() => setPendingDecline("")} type="button">Cancel</button></div> : null}
        </div>
        <div className="keyword-card-actions">{activeTab === "review" ? <><button className="primary-button" disabled={saving === keyword.keyword || saving === "batch"} onClick={() => void saveDecision(keyword.keyword, "approved")} type="button">Approve</button><button className="decline-button" disabled={saving === keyword.keyword || saving === "batch"} onClick={() => setPendingDecline(keyword.keyword)} type="button">Decline</button></> : <button className="secondary-button" disabled={saving === keyword.keyword} onClick={() => void restoreToReview(keyword.keyword)} type="button">{activeTab === "declined" ? "Restore to review" : "Move to review"}</button>}</div>
      </article>;
    })}</div>}

    {!strategyComplete ? <div className="strategy-review-finish"><div><strong>{canComplete ? "Ready to build your three-month content plan" : `Approve ${approvalsRemaining} more to continue`}</strong><p>{canComplete ? "Your approved keywords will feed the three-month editorial calendar, this week’s article drafts, and Rank Tracker." : `Approve ${INITIAL_KEYWORD_APPROVAL_TARGET} total. You do not need to decide all ${keywords.length}; decline only the searches that do not fit.`}</p></div><button aria-disabled={!canComplete || !questId} className="primary-button" disabled={saving === "quest"} onClick={() => void finish()} type="button">{saving === "quest" ? "Building your plan…" : canComplete ? "Build my three-month content plan" : `Approve ${approvalsRemaining} more to continue`}</button></div> : null}
    {error && <div aria-live="polite" className="error-banner">{error}</div>}
  </section>;
}
