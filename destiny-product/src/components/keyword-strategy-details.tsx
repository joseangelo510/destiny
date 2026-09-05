"use client";

export type KeywordRecommendation = {
  keyword: string;
  coverageDescription?: string;
  coverageCheckedAt?: string;
  pageType?: string;
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

export type KeywordTab = "review" | "approved" | "declined";
export type KeywordDecision = "approved" | "declined";
export type VerdictFilter = "all" | KeywordRecommendation["verdict"];
export type KeywordReason = "wrong_audience" | "not_offered" | "too_competitive" | "already_covered" | "not_now";

export const REASON_LABELS: Record<KeywordReason, string> = {
  wrong_audience: "Wrong audience",
  not_offered: "Not a service we offer",
  too_competitive: "Too competitive",
  already_covered: "Already covered",
  not_now: "Not now",
};

export const VERDICT_LABELS: Record<KeywordRecommendation["verdict"], string> = {
  improve: "Improve",
  create: "Create",
  defend: "Defend",
  overlap: "Overlap",
};

export const displayPath = (url: string) => {
  if (!url) return "no page yet";
  try { return new URL(url).pathname || "/"; } catch { return url; }
};

export type NextAction = {
  code: "review_keywords" | "create_first_article" | "review_weekly_content" | "track_progress";
  href: string;
  label: string;
  description: string;
};

export function KeywordActionDrawer({ keyword, onApprove, onPageType, pageType, saving }: { keyword: KeywordRecommendation; onApprove: () => void; onPageType: (value: string) => void; pageType?: string; saving: boolean }) {
  const recommendedPageType = keyword.providerIntent === "transactional" || keyword.searchIntent === "conversion"
    ? "Service landing page"
    : /\b(vs|versus|best|alternative|comparison)\b/i.test(keyword.keyword) ? "Comparison page" : "Blog guide / FAQ";
  const selectedPageType = pageType ?? recommendedPageType;
  const rankEvidence = keyword.rank > 0 ? `DataForSEO currently observes this result at #${keyword.rank}.` : "No current DataForSEO ranking was verified.";
  const gscEvidence = keyword.gscPosition > 0
    ? ` Search Console reports an average position of ${keyword.gscPosition.toFixed(1)} with ${keyword.gscImpressions.toLocaleString()} impressions and ${keyword.gscClicks.toLocaleString()} clicks in its latest snapshot.`
    : " Connect or refresh Search Console to add first-party impressions and clicks.";

  if (keyword.verdict === "create") return <div className="claude-ks-drawer">
    <h3>Content angle and page type</h3><p>Rebound SEO pre-selects from search intent. You can override it before any content is created.</p>
    <div className="claude-ks-page-types">{[
      ["Service landing page", "Agency, service, expert, hire, and pricing searches."],
      ["Comparison page", "“X vs Y,” alternatives, and best-solution searches."],
      ["Blog guide / FAQ", "Educational questions and research searches."],
    ].map(([label, description]) => <button aria-pressed={selectedPageType === label} className={selectedPageType === label ? "selected" : ""} key={label} onClick={() => onPageType(label)} type="button"><strong>{label}{selectedPageType === label ? " ✓" : ""}</strong><span>{description}</span></button>)}</div>
    <div className="claude-ks-drawer-action"><button disabled={saving} onClick={onApprove} type="button">Create content</button><span>Saves a brief in Content Studio. Generate and review before publishing.</span></div>
  </div>;

  if (keyword.verdict === "defend") return <div className="claude-ks-drawer">
    <h3>Protect {displayPath(keyword.rankingUrl)}</h3><p>{rankEvidence}{gscEvidence} This page is already winning, so Rebound SEO will preserve its structure and watch for a sustained drop.</p>
    <div className="claude-ks-defend-grid"><div><b>🔒</b><span><strong>Protect the winner</strong><small>Avoid unnecessary rewrites while it holds the top three.</small></span></div><div><b>📅</b><span><strong>Quarterly refresh</strong><small>Review dates, proof, testimonials, and offer details every 90 days.</small></span></div><div><b>🔔</b><span><strong>Slip alert</strong><small>Move it to Improve if verified rankings fall below the top three.</small></span></div></div>
    <div className="claude-ks-drawer-action"><button disabled={saving} onClick={onApprove} type="button">Include protection plan</button><span>Counts toward your five and starts weekly tracking.</span></div>
  </div>;

  if (keyword.verdict === "overlap") return <div className="claude-ks-drawer">
    <h3>Choose one primary page</h3><p>Multiple current URLs were verified for this search. Rebound SEO will keep one page primary and turn the others into supporting pages—without deleting or redirecting anything automatically.</p>
    <div className="claude-ks-overlap-pages">{keyword.rankingUrls.map((url, index) => <div className={index === 0 ? "primary" : ""} key={url}><small>{index === 0 ? "Primary · recommended" : "Supporting page"}</small><strong>{displayPath(url)}</strong></div>)}</div>
    <div className="claude-ks-drawer-action"><button disabled={saving} onClick={onApprove} type="button">Approve overlap plan</button><span>Nothing changes on your site without review.</span></div>
  </div>;

  return <div className="claude-ks-drawer">
    <h3>Page diagnostic: {displayPath(keyword.rankingUrl)}</h3><p>{rankEvidence}{gscEvidence} Approving this keyword prioritizes improving the existing page instead of creating a duplicate article.</p>
    <div className="claude-ks-diagnostics">
      <div><b>✓</b><span><strong>Existing page verified</strong><small>Rebound SEO found a current URL for this search.</small></span><em>Good</em></div>
      <div className="fix"><b>!</b><span><strong>Title, H1, and intent alignment</strong><small>Compare the page with the current leading results before editing.</small></span><em>Review</em></div>
      <div className="fix"><b>!</b><span><strong>Content and proof gaps</strong><small>Add missing evidence, answers, and conversion paths identified during optimization.</small></span><em>Review</em></div>
      <div className="fix"><b>!</b><span><strong>Internal links</strong><small>Find relevant pages that can strengthen this destination.</small></span><em>Review</em></div>
    </div>
    <div className="claude-ks-drawer-action"><button disabled={saving} onClick={onApprove} type="button">{saving ? "Creating your change doc…" : "Approve + create change doc"}</button><span>Counts toward your five. Nothing publishes without review.</span></div>
  </div>;
}

