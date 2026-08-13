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
  verdict: "improve" | "create" | "defend" | "overlap";
  verdictDescription: string;
  rankingUrl: string;
  rankingUrls: string[];
  gscPosition: number;
  gscImpressions: number;
  gscClicks: number;
};

type KeywordTab = "review" | "approved" | "declined";
type KeywordDecision = "approved" | "declined";
type VerdictFilter = "all" | KeywordRecommendation["verdict"];
type KeywordReason = "wrong_audience" | "not_offered" | "too_competitive" | "already_covered" | "not_now";

const REASON_LABELS: Record<KeywordReason, string> = {
  wrong_audience: "Wrong audience",
  not_offered: "Not a service we offer",
  too_competitive: "Too competitive",
  already_covered: "Already covered",
  not_now: "Not now",
};

const VERDICT_LABELS: Record<KeywordRecommendation["verdict"], string> = {
  improve: "Improve",
  create: "Create",
  defend: "Defend",
  overlap: "Overlap",
};

const displayPath = (url: string) => {
  if (!url) return "no page yet";
  try { return new URL(url).pathname || "/"; } catch { return url; }
};

type NextAction = {
  code: "review_keywords" | "create_first_article" | "review_weekly_content" | "track_progress";
  href: string;
  label: string;
  description: string;
};

function KeywordActionDrawer({ keyword, onApprove, onPageType, pageType, saving }: { keyword: KeywordRecommendation; onApprove: () => void; onPageType: (value: string) => void; pageType?: string; saving: boolean }) {
  const recommendedPageType = keyword.providerIntent === "transactional" || keyword.searchIntent === "conversion"
    ? "Service landing page"
    : /\b(vs|versus|best|alternative|comparison)\b/i.test(keyword.keyword) ? "Comparison page" : "Blog guide / FAQ";
  const selectedPageType = pageType ?? recommendedPageType;
  const rankEvidence = keyword.rank > 0 ? `DataForSEO currently observes this result at #${keyword.rank}.` : "No current DataForSEO ranking was verified.";
  const gscEvidence = keyword.gscPosition > 0
    ? ` Search Console reports an average position of ${keyword.gscPosition.toFixed(1)} with ${keyword.gscImpressions.toLocaleString()} impressions and ${keyword.gscClicks.toLocaleString()} clicks in its latest snapshot.`
    : " Connect or refresh Search Console to add first-party impressions and clicks.";

  if (keyword.verdict === "create") return <div className="claude-ks-drawer">
    <h3>Choose the page type first</h3><p>Destiny pre-selects from search intent. You can override it before any content is created.</p>
    <div className="claude-ks-page-types">{[
      ["Service landing page", "Agency, service, expert, hire, and pricing searches."],
      ["Comparison page", "“X vs Y,” alternatives, and best-solution searches."],
      ["Blog guide / FAQ", "Educational questions and research searches."],
    ].map(([label, description]) => <button aria-pressed={selectedPageType === label} className={selectedPageType === label ? "selected" : ""} key={label} onClick={() => onPageType(label)} type="button"><strong>{label}{selectedPageType === label ? " ✓" : ""}</strong><span>{description}</span></button>)}</div>
    <div className="claude-ks-drawer-action"><button disabled={saving} onClick={onApprove} type="button">Approve with this page type</button><span>Draft only. You review before publishing.</span></div>
  </div>;

  if (keyword.verdict === "defend") return <div className="claude-ks-drawer">
    <h3>Protect {displayPath(keyword.rankingUrl)}</h3><p>{rankEvidence}{gscEvidence} This page is already winning, so Destiny will preserve its structure and watch for a sustained drop.</p>
    <div className="claude-ks-defend-grid"><div><b>🔒</b><span><strong>Protect the winner</strong><small>Avoid unnecessary rewrites while it holds the top three.</small></span></div><div><b>📅</b><span><strong>Quarterly refresh</strong><small>Review dates, proof, testimonials, and offer details every 90 days.</small></span></div><div><b>🔔</b><span><strong>Slip alert</strong><small>Move it to Improve if verified rankings fall below the top three.</small></span></div></div>
    <div className="claude-ks-drawer-action"><button disabled={saving} onClick={onApprove} type="button">Include protection plan</button><span>Counts toward your five and starts weekly tracking.</span></div>
  </div>;

  if (keyword.verdict === "overlap") return <div className="claude-ks-drawer">
    <h3>Choose one primary page</h3><p>Multiple current URLs were verified for this search. Destiny will keep one page primary and turn the others into supporting pages—without deleting or redirecting anything automatically.</p>
    <div className="claude-ks-overlap-pages">{keyword.rankingUrls.map((url, index) => <div className={index === 0 ? "primary" : ""} key={url}><small>{index === 0 ? "Primary · recommended" : "Supporting page"}</small><strong>{displayPath(url)}</strong></div>)}</div>
    <div className="claude-ks-drawer-action"><button disabled={saving} onClick={onApprove} type="button">Approve overlap plan</button><span>Nothing changes on your site without review.</span></div>
  </div>;

  return <div className="claude-ks-drawer">
    <h3>Page diagnostic: {displayPath(keyword.rankingUrl)}</h3><p>{rankEvidence}{gscEvidence} Approving this keyword prioritizes improving the existing page instead of creating a duplicate article.</p>
    <div className="claude-ks-diagnostics">
      <div><b>✓</b><span><strong>Existing page verified</strong><small>Destiny found a current URL for this search.</small></span><em>Good</em></div>
      <div className="fix"><b>!</b><span><strong>Title, H1, and intent alignment</strong><small>Compare the page with the current leading results before editing.</small></span><em>Review</em></div>
      <div className="fix"><b>!</b><span><strong>Content and proof gaps</strong><small>Add missing evidence, answers, and conversion paths identified during optimization.</small></span><em>Review</em></div>
      <div className="fix"><b>!</b><span><strong>Internal links</strong><small>Find relevant pages that can strengthen this destination.</small></span><em>Review</em></div>
    </div>
    <div className="claude-ks-drawer-action"><button disabled={saving} onClick={onApprove} type="button">{saving ? "Creating your change doc…" : "Approve + create change doc"}</button><span>Counts toward your five. Nothing publishes without review.</span></div>
  </div>;
}

export function KeywordStrategyReview({ auditHref, auditId, initialDecisions, initialDocumentLinks = {}, initialReasons, initialTab, keywords, moreKeywordsHref, nextAction, nextHref, questId, questStatus }: {
  auditHref?: string;
  auditId: string;
  initialDecisions: Record<string, KeywordDecision>;
  initialDocumentLinks?: Record<string, string>;
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
  const [statusLink, setStatusLink] = useState<{ href: string; label: string } | null>(null);
  const [documentLinks, setDocumentLinks] = useState(initialDocumentLinks);
  const [showAll, setShowAll] = useState(false);
  const [verdictFilter, setVerdictFilter] = useState<VerdictFilter>("all");
  const [openDrawer, setOpenDrawer] = useState("");
  const [pageTypes, setPageTypes] = useState<Record<string, string>>({});

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
  const filteredKeywords = verdictFilter === "all" ? visibleKeywords : visibleKeywords.filter((keyword) => keyword.verdict === verdictFilter);
  const displayedKeywords = showAll ? filteredKeywords : filteredKeywords.slice(0, 10);
  const verdictCounts = (Object.keys(VERDICT_LABELS) as KeywordRecommendation["verdict"][]).reduce<Record<string, number>>((counts, verdict) => ({ ...counts, [verdict]: visibleKeywords.filter((keyword) => keyword.verdict === verdict).length }), {});

  const selectTab = (tab: KeywordTab) => {
    setActiveTab(tab);
    setShowAll(false);
    setPendingDecline("");
    setVerdictFilter("all");
    setOpenDrawer("");
  };

  const themeCoverage = Object.values(keywords.reduce<Record<string, { label: string; count: number }>>((themes, keyword) => {
    const id = keyword.themeId || "evidence-based";
    const current = themes[id] ?? { label: keyword.themeLabel || "Evidence-based opportunity", count: 0 };
    themes[id] = { ...current, count: current.count + 1 };
    return themes;
  }, {})).sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));

  const saveDecision = async (keyword: string, decision: KeywordDecision, reason: KeywordReason | null = null): Promise<boolean> => {
    setSaving(keyword);
    setError("");
    setStatus("");
    setStatusLink(null);
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
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Destiny could not save the keyword decision.");
      return false;
    } finally {
      setSaving("");
    }
  };

  const createChangeDocument = async (keyword: KeywordRecommendation, regenerate = false) => {
    setSaving(keyword.keyword);
    setError("");
    setStatusLink(null);
    try {
      const response = await fetch("/api/reoptimization-documents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ auditId, keyword: keyword.keyword, regenerate }) });
      const payload = await response.json() as { error?: string; document?: { url?: string } };
      if (!response.ok || !payload.document?.url) throw new Error(payload.error || "Destiny could not create the change document.");
      const href = payload.document.url;
      setDocumentLinks((current) => ({ ...current, [keyword.keyword]: href }));
      setStatus(`Approved “${keyword.keyword}.” Your change doc for ${displayPath(keyword.rankingUrl)} is ready.`);
      setStatusLink({ href, label: "View change doc" });
      setOpenDrawer("");
      return true;
    } catch (cause) {
      setStatus(`“${keyword.keyword}” is approved, but the change doc could not be created. Your approval and rank tracking were saved.`);
      setError(cause instanceof Error ? cause.message : "Destiny could not create the change document. Try again from Approved.");
      return false;
    } finally {
      setSaving("");
    }
  };

  const approveForReoptimization = async (keyword: KeywordRecommendation) => {
    const approved = await saveDecision(keyword.keyword, "approved");
    if (approved) await createChangeDocument(keyword);
  };

  const restoreToReview = async (keyword: string) => {
    setSaving(keyword);
    setError("");
    setStatus("");
    setStatusLink(null);
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

    {visibleKeywords.length > 0 ? <div aria-label="Filter keywords by site verdict" className="claude-ks-verdict-filters" role="group">
      <span>Checked against your site:</span>
      <button className={verdictFilter === "all" ? "active" : ""} onClick={() => { setVerdictFilter("all"); setShowAll(false); }} type="button">All <b>{visibleKeywords.length}</b></button>
      {(Object.keys(VERDICT_LABELS) as KeywordRecommendation["verdict"][]).map((verdict) => <button className={`${verdictFilter === verdict ? "active" : ""} ${verdict}`} key={verdict} onClick={() => { setVerdictFilter(verdict); setShowAll(false); }} type="button">{verdict === "improve" ? "Improve · quick wins" : VERDICT_LABELS[verdict]} <b>{verdictCounts[verdict]}</b></button>)}
    </div> : null}

    {status && <div aria-live="polite" className="integration-banner success keyword-decision-status" role="status"><strong>Decision saved</strong><p>{status}{statusLink ? <> <Link href={statusLink.href}>{statusLink.label} →</Link></> : null}</p></div>}

    {!visibleKeywords.length ? <section className="claude-ks-panel" role="tabpanel"><div className="claude-ks-empty"><span aria-hidden="true">✓</span><h3>{activeTab === "review" ? "You’re all caught up" : activeTab === "approved" ? "No approved keywords yet" : "No declined keywords"}</h3><p>{activeTab === "review" ? "Every recommendation from your last audit has been reviewed. New keyword ideas arrive with your next audit." : activeTab === "approved" ? "Approve relevant searches from To Review to build the working plan." : "Keywords you decline remain here with their reason, ready to restore anytime."}</p><div>{activeTab !== "review" && <button onClick={() => selectTab("review")} type="button">Open To Review</button>}{activeTab === "review" && auditHref ? <Link href={auditHref}>Run a new audit</Link> : null}{!auditHref && activeTab === "review" ? <Link href={moreKeywordsHref}>Find more keywords</Link> : null}</div></div></section> : !filteredKeywords.length ? <section className="claude-ks-panel" role="tabpanel"><div className="claude-ks-empty"><span aria-hidden="true">✓</span><h3>No {verdictFilter} keywords in this list</h3><p>Choose another verdict to see the recommendations Destiny checked against your site.</p><div><button onClick={() => setVerdictFilter("all")} type="button">Show all keywords</button></div></div></section> : <section className="claude-ks-panel" role="tabpanel">
      <div className="claude-ks-table-scroll"><table><thead><tr><th>Keyword</th><th>Intent</th><th>Monthly searches</th><th>Opportunity</th><th>Plan status</th><th>Action</th></tr></thead><tbody>{displayedKeywords.map((keyword) => {
        const decision = decisions[keyword.keyword];
        const reason = reasons[keyword.keyword];
        const opportunityLabel = keyword.priorityScore >= 70 ? "High" : keyword.priorityScore >= 50 ? "Good" : "Fair";
        const opportunityWidth = `${Math.max(12, Math.min(100, keyword.priorityScore))}%`;
        const intentLabel = keyword.providerIntent.charAt(0).toUpperCase() + keyword.providerIntent.slice(1);
        return <Fragment key={keyword.keyword}><tr className={decision ?? "pending"} ref={keyword.keyword === firstUnreviewedKeyword ? firstUnreviewedRef : undefined} tabIndex={keyword.keyword === firstUnreviewedKeyword ? -1 : undefined}>
          <td className="claude-ks-keyword"><strong>{keyword.keyword}</strong><small>{keyword.priorityReason}</small><div className="claude-ks-rank-evidence"><span>OBS</span> <b>{keyword.rank > 0 ? `#${keyword.rank}` : "—"}</b><i>·</i><span>GSC</span> <b className="gsc">{keyword.gscPosition > 0 ? keyword.gscPosition.toFixed(1) : "—"}</b><i>·</i><em title={keyword.rankingUrl || undefined}>{displayPath(keyword.rankingUrl)}</em></div></td>
          <td><span className={`claude-ks-intent ${keyword.providerIntent}`}>{intentLabel}</span></td>
          <td className="claude-ks-number">{keyword.searchVolume.toLocaleString()}</td>
          <td><div className="claude-ks-opportunity" title={`${keyword.priorityScore} out of 100`}><span><i style={{ width: opportunityWidth }} /></span><b>{opportunityLabel}</b></div></td>
          <td className="claude-ks-plan-status">{decision === "declined" ? <><strong>{reason && reason in REASON_LABELS ? REASON_LABELS[reason as KeywordReason] : "Saved feedback"}</strong> · Restorable</> : <><span className={`claude-ks-verdict ${keyword.verdict}`}>{VERDICT_LABELS[keyword.verdict]}</span><small>{decision === "approved" ? keyword.verdict === "improve" ? `In plan · re-optimizing ${displayPath(keyword.rankingUrl)}` : "In plan · tracking weekly" : keyword.verdictDescription}</small></>}</td>
          <td className="claude-ks-row-actions">{activeTab === "review" ? <><button aria-label={keyword.verdict === "improve" ? "Re-optimize: opens Approve + create change doc" : undefined} className="primary" disabled={saving === keyword.keyword || saving === "batch"} onClick={() => setOpenDrawer((current) => current === keyword.keyword ? "" : keyword.keyword)} type="button">{keyword.verdict === "improve" ? "Re-optimize" : keyword.verdict === "overlap" ? "Resolve overlap" : keyword.verdict === "defend" ? "Protect" : "Approve"}</button><button disabled={saving === keyword.keyword || saving === "batch"} onClick={() => setPendingDecline(keyword.keyword)} type="button">Decline</button></> : activeTab === "approved" ? <>{keyword.verdict === "improve" ? documentLinks[keyword.keyword] ? <><Link href={documentLinks[keyword.keyword]}>Change doc</Link><button disabled={saving === keyword.keyword} onClick={() => void createChangeDocument(keyword, true)} title="Runs new DataForSEO research and creates a fresh plan" type="button">{saving === keyword.keyword ? "Refreshing…" : "Refresh research"}</button></> : <button disabled={saving === keyword.keyword} onClick={() => void createChangeDocument(keyword)} type="button">{saving === keyword.keyword ? "Creating…" : "Create change doc"}</button> : null}<button disabled={saving === keyword.keyword} onClick={() => void restoreToReview(keyword.keyword)} type="button">Unapprove</button></> : <button disabled={saving === keyword.keyword} onClick={() => void restoreToReview(keyword.keyword)} type="button">Restore to review</button>}</td>
        </tr>{openDrawer === keyword.keyword && activeTab === "review" ? <tr className="claude-ks-drawer-row"><td colSpan={6}><KeywordActionDrawer keyword={keyword} pageType={pageTypes[keyword.keyword]} saving={saving === keyword.keyword} onPageType={(pageType) => setPageTypes((current) => ({ ...current, [keyword.keyword]: pageType }))} onApprove={() => void (keyword.verdict === "improve" ? approveForReoptimization(keyword) : saveDecision(keyword.keyword, "approved"))} /></td></tr> : null}{pendingDecline === keyword.keyword ? <tr><td className="claude-ks-decline" colSpan={6}><strong>Why decline? <small>Optional</small></strong><div>{(Object.keys(REASON_LABELS) as KeywordReason[]).map((code) => <button disabled={saving === keyword.keyword} key={code} onClick={() => void saveDecision(keyword.keyword, "declined", code)} type="button">{REASON_LABELS[code]}</button>)}</div><button disabled={saving === keyword.keyword} onClick={() => void saveDecision(keyword.keyword, "declined")} type="button">Decline without a reason</button><button onClick={() => setPendingDecline("")} type="button">Cancel</button></td></tr> : null}</Fragment>;
      })}</tbody></table></div>
      <footer className="claude-ks-table-foot"><span>Showing {displayedKeywords.length} of {filteredKeywords.length} {activeTab === "review" ? "keywords to review" : `${activeTab} keywords`}{activeTab === "declined" ? " · Restoring sends a keyword back to To Review" : ""}</span>{filteredKeywords.length > 10 ? <button onClick={() => setShowAll((current) => !current)} type="button">{showAll ? "Show first 10" : `View all ${filteredKeywords.length}`} <span aria-hidden="true">→</span></button> : null}</footer>
    </section>}

    {!strategyComplete ? <div className="claude-ks-finish"><div><strong>{canComplete ? "Ready to build your three-month content plan" : `Approve ${approvalsRemaining} more to continue`}</strong><p>{canComplete ? "Your approved keywords will feed the three-month editorial calendar, this week’s article drafts, and Rank Tracker." : `Approve ${INITIAL_KEYWORD_APPROVAL_TARGET} total. You do not need to decide all ${keywords.length}; decline only the searches that do not fit.`}</p></div><button aria-disabled={!canComplete || !questId} disabled={saving === "quest"} onClick={() => void finish()} type="button">{saving === "quest" ? "Building your plan…" : canComplete ? "Build my three-month content plan" : `Approve ${approvalsRemaining} more to continue`}</button></div> : null}
    {error && <div aria-live="polite" className="error-banner">{error}</div>}
  </section>;
}
