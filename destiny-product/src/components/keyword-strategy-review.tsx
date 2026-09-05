"use client";

import { WorkspaceLink as Link } from "./workspace-link";
import { useRouter } from "next/navigation";
import { Fragment, useRef, useState } from "react";
import { KeywordContentPlanConfirmation, useKeywordContentPlan } from "./keyword-content-plan";
import { INITIAL_KEYWORD_APPROVAL_TARGET } from "../lib/product/plan-horizon";

import { KeywordActionDrawer, recommendedKeywordPageType, REASON_LABELS, VERDICT_LABELS, displayPath, type KeywordRecommendation, type KeywordTab, type KeywordDecision, type VerdictFilter, type KeywordReason, type NextAction } from "./keyword-strategy-details";

function DiscoveryLink({ href }: { href: string }) {
  const [pending, setPending] = useState(false);
  return <a aria-label="Discover more recommendations" aria-busy={pending} href={href} onClick={event => { if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) setPending(true); }}><span role="status">{pending ? "Finding more recommendations…" : "Discover more recommendations →"}</span></a>;
}

export function KeywordStrategyReview({ auditHref, auditId, initialDecisions, initialDocumentLinks = {}, initialReasons, initialTab, keywords, moreKeywordsHref, nextAction, nextHref, questId, questStatus, websiteId, newResearchStatus = "ready", discoveryRound = 0, newKeywordOrder = [] }: {
  websiteId: string;
  discoveryRound?: number;
  newKeywordOrder?: string[];
  newResearchStatus?: "ready" | "unavailable";
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
  const [newLimit, setNewLimit] = useState(discoveryRound ? 30 + discoveryRound * 15 : 15);
  const [showAll, setShowAll] = useState(false);
  const [verdictFilter, setVerdictFilter] = useState<VerdictFilter>("all");
  const [openDrawer, setOpenDrawer] = useState("");
  const [pageTypes, setPageTypes] = useState<Record<string, string>>({});

  const plan = useKeywordContentPlan({ websiteId, auditId, approve: async keyword => { const result = await saveDecision(keyword, "approved"); setStatus(""); setError(""); return result; }, refresh: () => router.refresh() });
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
  const newOrder = new Map(newKeywordOrder.map((keyword, index) => [keyword, index]));
  const newKeywords = keywords.filter((keyword) => (!decisions[keyword.keyword] || Boolean(plan.entries[keyword.keyword])) && decisions[keyword.keyword] !== "declined" && keyword.verdict === "create" && keyword.searchVolume > 0).sort((a, b) => (newOrder.get(a.keyword) ?? 9999) - (newOrder.get(b.keyword) ?? 9999));
  const existingKeywords = activeTab === "review" ? visibleKeywords.filter((keyword) => !newKeywords.includes(keyword)) : visibleKeywords;
  const filteredKeywords = verdictFilter === "all" ? existingKeywords : existingKeywords.filter((keyword) => keyword.verdict === verdictFilter);
  const displayedKeywords = showAll ? filteredKeywords : filteredKeywords.slice(0, 10);
  const verdictCounts = (Object.keys(VERDICT_LABELS) as KeywordRecommendation["verdict"][]).reduce<Record<string, number>>((counts, verdict) => ({ ...counts, [verdict]: existingKeywords.filter((keyword) => keyword.verdict === verdict).length }), {});

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
      const response = await fetch("/api/keywords/decisions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ auditId, keyword, decision, reason, evidence: keywords.find((item) => item.keyword === keyword) }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Rebound SEO could not save the keyword decision.");
      setDecisions((current) => ({ ...current, [keyword]: decision }));
      setReasons((current) => ({ ...current, [keyword]: reason }));
      setPendingDecline("");
      if (decision === "declined") plan.forget(keyword);
      setStatus(decision === "approved"
        ? `Approved “${keyword}.” It now supports your three-month plan and weekly rank tracking.`
        : `Moved “${keyword}” to Declined. Rebound SEO will use this feedback when shaping future recommendations.`);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Rebound SEO could not save the keyword decision.");
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
      if (!response.ok || !payload.document?.url) throw new Error(payload.error || "Rebound SEO could not create the change document.");
      const href = payload.document.url;
      setDocumentLinks((current) => ({ ...current, [keyword.keyword]: href }));
      setStatus(`Approved “${keyword.keyword}.” Your change doc for ${displayPath(keyword.rankingUrl)} is ready.`);
      setStatusLink({ href, label: "View change doc" });
      setOpenDrawer("");
      return true;
    } catch (cause) {
      setStatus(`“${keyword.keyword}” is approved, but the change doc could not be created. Your approval and rank tracking were saved.`);
      setError(cause instanceof Error ? cause.message : "Rebound SEO could not create the change document. Try again from Approved.");
      return false;
    } finally {
      setSaving("");
    }
  };

  const approveForReoptimization = async (keyword: KeywordRecommendation) => {
    const approved = await saveDecision(keyword.keyword, "approved");
    if (approved) await createChangeDocument(keyword);
  };

  const createContent = (keyword: KeywordRecommendation) => plan.add(keyword.keyword, decisions[keyword.keyword] === "approved", pageTypes[keyword.keyword] ?? recommendedKeywordPageType(keyword));

  const restoreToReview = async (keyword: string) => {
    setSaving(keyword);
    setError("");
    setStatus("");
    setStatusLink(null);
    try {
      const response = await fetch("/api/keywords/decisions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ auditId, keyword, action: "restore" }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Rebound SEO could not restore this keyword.");
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
      plan.forget(keyword);
      setActiveTab("review");
      setStatus(`“${keyword}” is back in To Review. Existing drafts and rank history were kept.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Rebound SEO could not restore this keyword.");
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
      setError("Rebound SEO could not find the keyword review task. Refresh the page and try again.");
      return;
    }
    setSaving("quest");
    try {
      const response = await fetch(`/api/quests/${encodeURIComponent(questId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "complete" }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Rebound SEO could not finish the keyword review.");
      router.push(nextHref);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Rebound SEO could not finish the keyword review.");
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
      const response = await fetch("/api/keywords/decisions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ auditId, decisions: candidates.map((candidate) => ({ keyword: candidate.keyword, decision: "approved", evidence: candidate })) }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Rebound SEO could not save the keyword decisions.");
      setDecisions((current) => ({ ...current, ...Object.fromEntries(candidates.map((candidate) => [candidate.keyword, "approved"])) }));
      setStatus(`${candidates.length} recommended keyword${candidates.length === 1 ? "" : "s"} approved. You can review or change every choice from Approved.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Rebound SEO could not save the keyword decisions.");
    } finally {
      setSaving("");
    }
  };

  const renderTable = (tableKeywords: KeywordRecommendation[], tableTotal: number, isNew = false) => <section className="claude-ks-panel" role="tabpanel">
      <div className="claude-ks-table-scroll"><table><thead><tr><th>Keyword</th><th>Intent</th><th>Monthly searches</th><th>Opportunity</th><th>Plan status</th><th>Action</th></tr></thead><tbody>{tableKeywords.map((keyword) => {
        const decision = decisions[keyword.keyword];
        const entry = plan.entries[keyword.keyword];
        const reason = reasons[keyword.keyword];
        const opportunityLabel = keyword.priorityScore >= 70 ? "High" : keyword.priorityScore >= 50 ? "Good" : "Fair";
        const opportunityWidth = `${Math.max(12, Math.min(100, keyword.priorityScore))}%`;
        const intentLabel = keyword.providerIntent.charAt(0).toUpperCase() + keyword.providerIntent.slice(1);
        return <Fragment key={keyword.keyword}><tr className={decision ?? "pending"} ref={keyword.keyword === firstUnreviewedKeyword ? firstUnreviewedRef : undefined} tabIndex={keyword.keyword === firstUnreviewedKeyword ? -1 : undefined}>
          <td className="claude-ks-keyword"><strong>{keyword.verdict === "create" ? <button aria-expanded={openDrawer === keyword.keyword} aria-label={`Show content angle for ${keyword.keyword}`} className="claude-ks-angle" onClick={() => setOpenDrawer((current) => current === keyword.keyword ? "" : keyword.keyword)} type="button">{openDrawer === keyword.keyword ? "⌄" : "›"}</button> : null}{keyword.keyword}</strong><small>{keyword.priorityReason}</small>{keyword.verdict === "create" ? <div className="claude-ks-rank-evidence"><span>NEW</span><i>·</i><em>{keyword.coverageDescription || "No page verified in the saved audit"}</em></div> : <div className="claude-ks-rank-evidence"><span>OBS</span> <b>{keyword.rank > 0 ? `#${keyword.rank}` : "—"}</b><i>·</i><span>GSC</span> <b className="gsc">{keyword.gscPosition > 0 ? keyword.gscPosition.toFixed(1) : "—"}</b><i>·</i><em title={keyword.rankingUrl || undefined}>{displayPath(keyword.rankingUrl)}</em></div>}</td>
          <td><span className={`claude-ks-intent ${keyword.providerIntent}`}>{intentLabel}</span></td>
          <td className="claude-ks-number">{keyword.searchVolume.toLocaleString()}</td>
          <td><div className="claude-ks-opportunity" title={`${keyword.priorityScore} out of 100`}><span><i style={{ width: opportunityWidth }} /></span><b>{opportunityLabel}</b></div></td>
          <td className="claude-ks-plan-status">{decision === "declined" ? <><strong>{reason && reason in REASON_LABELS ? REASON_LABELS[reason as KeywordReason] : "Saved feedback"}</strong> · Restorable</> : <><span className={`claude-ks-verdict ${keyword.verdict}`}>{keyword.verdict === "create" && decision === "approved" ? "In plan" : VERDICT_LABELS[keyword.verdict]}</span><small>{decision === "approved" ? keyword.verdict === "improve" ? `In plan · re-optimizing ${displayPath(keyword.rankingUrl)}` : entry?.state === "saved" ? "Brief saved" : "Topic approved" : keyword.verdictDescription}</small></>}</td>
          <td className="claude-ks-row-actions">{activeTab === "review" ? <><button aria-label={keyword.verdict === "improve" ? "Re-optimize: opens Approve + create change doc" : undefined} className="primary" disabled={Boolean(saving) || plan.busy || entry?.state === "adding" || entry?.state === "saved"} onClick={() => keyword.verdict === "create" ? void createContent(keyword) : setOpenDrawer((current) => current === keyword.keyword ? "" : keyword.keyword)} type="button">{keyword.verdict === "improve" ? "Re-optimize" : keyword.verdict === "overlap" ? "Resolve overlap" : keyword.verdict === "defend" ? "Protect" : entry?.state === "saved" ? "Added" : entry?.state === "adding" ? "Adding…" : "Add to content plan"}</button>{entry?.state !== "saved" ? <button disabled={Boolean(saving) || plan.busy} onClick={() => setPendingDecline(keyword.keyword)} type="button">Decline</button> : null}</> : activeTab === "approved" ? <>{keyword.verdict === "create" ? <button disabled={Boolean(saving) || plan.busy || entry?.state === "saved"} onClick={() => void createContent(keyword)} type="button">{entry?.state === "saved" ? "Added" : entry?.state === "adding" ? "Adding…" : "Add to content plan"}</button> : null}{keyword.verdict === "improve" ? documentLinks[keyword.keyword] ? <><Link href={documentLinks[keyword.keyword]}>Change doc</Link><button disabled={saving === keyword.keyword} onClick={() => void createChangeDocument(keyword, true)} title="Runs new DataForSEO research and creates a fresh plan" type="button">{saving === keyword.keyword ? "Refreshing…" : "Refresh research"}</button></> : <button disabled={saving === keyword.keyword} onClick={() => void createChangeDocument(keyword)} type="button">{saving === keyword.keyword ? "Creating…" : "Create change doc"}</button> : null}<button disabled={Boolean(saving) || plan.busy} onClick={() => void restoreToReview(keyword.keyword)} type="button">Unapprove</button></> : <button disabled={Boolean(saving) || plan.busy} onClick={() => void restoreToReview(keyword.keyword)} type="button">Restore to review</button>}</td>
        </tr>{entry ? <KeywordContentPlanConfirmation entry={entry} keyword={keyword.keyword} websiteId={websiteId} retry={() => void createContent(keyword)} /> : null}{openDrawer === keyword.keyword && !entry && activeTab === "review" ? <tr className="claude-ks-drawer-row"><td colSpan={6}><KeywordActionDrawer keyword={keyword} pageType={pageTypes[keyword.keyword]} saving={saving === keyword.keyword} onPageType={(pageType) => setPageTypes((current) => ({ ...current, [keyword.keyword]: pageType }))} onApprove={() => void (keyword.verdict === "create" ? createContent(keyword) : keyword.verdict === "improve" ? approveForReoptimization(keyword) : saveDecision(keyword.keyword, "approved"))} /></td></tr> : null}{pendingDecline === keyword.keyword ? <tr><td className="claude-ks-decline" colSpan={6}><strong>Why decline? <small>Optional</small></strong><div>{(Object.keys(REASON_LABELS) as KeywordReason[]).map((code) => <button disabled={saving === keyword.keyword} key={code} onClick={() => void saveDecision(keyword.keyword, "declined", code)} type="button">{REASON_LABELS[code]}</button>)}</div><button disabled={saving === keyword.keyword} onClick={() => void saveDecision(keyword.keyword, "declined")} type="button">Decline without a reason</button><button onClick={() => setPendingDecline("")} type="button">Cancel</button></td></tr> : null}</Fragment>;
      })}</tbody></table></div>
      <footer className="claude-ks-table-foot"><span>Showing {tableKeywords.length} of {tableTotal} {isNew ? "recommendations" : activeTab === "review" ? "keywords to review" : `${activeTab} keywords`}{activeTab === "declined" ? " · Restoring sends a keyword back to To Review" : ""}</span>{isNew ? tableTotal > newLimit ? <button onClick={() => setNewLimit(current => current + 15)} type="button">Show {Math.min(15, tableTotal - newLimit)} more <span aria-hidden="true">→</span></button> : null : tableTotal > 10 ? <button onClick={() => setShowAll(current => !current)} type="button">{showAll ? "Show first 10" : `View all ${tableTotal}`} <span aria-hidden="true">→</span></button> : null}</footer>
    </section>;

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

    {activeTab === "review" ? <section aria-label="New keyword recommendations" className="claude-ks-new-section">
      <div className="claude-ks-section-heading"><h3>New keyword recommendations <span>{newKeywords.filter(keyword => !decisions[keyword.keyword]).length}</span></h3><p>New content ideas matched to your business and customers using your onboarding answers.</p></div>
      {newKeywords.length ? renderTable(newKeywords.slice(0, newLimit), newKeywords.length, true) : <p className="claude-ks-section-note">{newResearchStatus === "unavailable" ? "New keyword research is temporarily unavailable. Your existing strategy is still available below." : "No additional measured opportunities cleared the current checks. Your approved and declined keywords are saved in their tabs."}</p>}
      {newKeywords.length > 0 && newResearchStatus === "unavailable" ? <p className="claude-ks-section-note" role="status">Additional research is temporarily unavailable. Your saved options remain available.</p> : null}
      <p className="claude-ks-section-note">{discoveryRound < 5 ? <DiscoveryLink href={`/keywords?site=${websiteId}&discover=${discoveryRound + 1}#keyword-strategy-review`} /> : <Link href={moreKeywordsHref}>Explore more keywords →</Link>} · Uses your saved business, customer, and problem details.</p>
      {newKeywords.length > 0 ? <p className="claude-ks-section-note">Keep choosing keywords. Start writing whenever you are ready. Adding a topic saves its brief; publication scheduling follows article approval. Coverage reflects checked pages and search results; it is not a full-site crawl.</p> : null}
      <div className="claude-ks-section-heading"><h3>Existing keyword opportunities <span>{existingKeywords.length}</span></h3><p>Improve or protect the pages your site already has.</p></div>
    </section> : null}

    {activeTab === "review" && reviewKeywords.length > 0 ? <div className="claude-ks-review-context">
      <div><strong>{themeCoverage.length} distinct search themes</strong><span>No single phrase family can consume the whole strategy.</span></div>
      <div className="claude-ks-review-actions">{!canComplete && <button disabled={!recommendedUnreviewed.length || saving === "batch"} onClick={() => void approveMany(recommendedUnreviewed)} type="button">Approve next {approvalsRemaining}</button>}<Link href={moreKeywordsHref}>Find more keywords</Link></div>
    </div> : null}

    {visibleKeywords.length > 0 ? <div aria-label="Filter keywords by site verdict" className="claude-ks-verdict-filters" role="group">
      <span>Checked against your site:</span>
      <button className={verdictFilter === "all" ? "active" : ""} onClick={() => { setVerdictFilter("all"); setShowAll(false); }} type="button">All <b>{existingKeywords.length}</b></button>
      {(Object.keys(VERDICT_LABELS) as KeywordRecommendation["verdict"][]).map((verdict) => <button className={`${verdictFilter === verdict ? "active" : ""} ${verdict}`} key={verdict} onClick={() => { setVerdictFilter(verdict); setShowAll(false); }} type="button">{verdict === "improve" ? "Improve · quick wins" : VERDICT_LABELS[verdict]} <b>{verdictCounts[verdict]}</b></button>)}
    </div> : null}

    {status && <div aria-live="polite" className="integration-banner success keyword-decision-status" role="status"><strong>Decision saved</strong><p>{status}{statusLink ? <> <Link href={statusLink.href}>{statusLink.label} →</Link></> : null}</p></div>}

    {!visibleKeywords.length ? <section className="claude-ks-panel" role="tabpanel"><div className="claude-ks-empty"><span aria-hidden="true">✓</span><h3>{activeTab === "review" ? "You’re all caught up" : activeTab === "approved" ? "No approved keywords yet" : "No declined keywords"}</h3><p>{activeTab === "review" ? "Every recommendation from your last audit has been reviewed. New keyword ideas arrive with your next audit." : activeTab === "approved" ? "Approve relevant searches from To Review to build the working plan." : "Keywords you decline remain here with their reason, ready to restore anytime."}</p><div>{activeTab !== "review" && <button onClick={() => selectTab("review")} type="button">Open To Review</button>}{activeTab === "review" && auditHref ? <Link href={auditHref}>Run a new audit</Link> : null}{!auditHref && activeTab === "review" ? <Link href={moreKeywordsHref}>Find more keywords</Link> : null}</div></div></section> : !filteredKeywords.length ? <section className="claude-ks-panel" role="tabpanel"><div className="claude-ks-empty"><span aria-hidden="true">✓</span><h3>{verdictFilter === "all" && activeTab === "review" ? "No existing-page opportunities in this list" : `No ${verdictFilter} keywords in this list`}</h3><p>Choose another verdict to see the recommendations Rebound SEO checked against your site.</p><div><button onClick={() => setVerdictFilter("all")} type="button">Show all keywords</button></div></div></section> : renderTable(displayedKeywords, filteredKeywords.length)}

    {!strategyComplete ? <div className="claude-ks-finish"><div><strong>{canComplete ? "Ready to build your three-month content plan" : `Approve ${approvalsRemaining} more to continue`}</strong><p>{canComplete ? "Your approved keywords will feed the three-month editorial calendar, this week’s article drafts, and Rank Tracker." : `Approve ${INITIAL_KEYWORD_APPROVAL_TARGET} total. You do not need to decide all ${keywords.length}; decline only the searches that do not fit.`}</p></div><button aria-disabled={!canComplete || !questId} disabled={saving === "quest"} onClick={() => void finish()} type="button">{saving === "quest" ? "Building your plan…" : canComplete ? "Build my three-month content plan" : `Approve ${approvalsRemaining} more to continue`}</button></div> : null}
    {error && <div aria-live="polite" className="error-banner">{error}</div>}
  </section>;
}
