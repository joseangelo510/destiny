import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { KeywordStrategyReview } from "./keyword-strategy-review";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const keywords = Array.from({ length: 25 }, (_, index) => ({
  keyword: `revenue keyword ${index + 1}`,
  searchVolume: 100 + index,
  difficulty: 25,
  competitorRankers: 2,
  rank: 0,
  cpc: 4,
  opportunity: "competitor_gap",
  providerIntent: "commercial" as const,
  searchIntent: "consideration" as const,
  priorityScore: 80 - index,
  priorityReason: "Comparison intent with meaningful demand",
  themeId: `theme-${index % 4}`,
  themeLabel: `Theme ${(index % 4) + 1}`,
  themeRole: "revenue",
  essential: index < 3,
  verdict: index === 0 ? "improve" as const : "create" as const,
  verdictDescription: index === 0 ? "Page two · a practical quick win" : "No page is verified for this search",
  rankingUrl: index === 0 ? "https://example.com/services" : "",
  rankingUrls: index === 0 ? ["https://example.com/services"] : [],
  gscPosition: index === 0 ? 13.2 : 0,
  gscImpressions: index === 0 ? 1850 : 0,
  gscClicks: index === 0 ? 12 : 0,
}));

describe("KeywordStrategyReview planning horizon", () => {
  it("makes five approvals sufficient without forcing a review of all 25", () => {
    const html = renderToStaticMarkup(<KeywordStrategyReview
      auditId="audit-1"
      initialDecisions={Object.fromEntries(keywords.slice(0, 5).map((keyword) => [keyword.keyword, "approved" as const]))}
      keywords={keywords}
      moreKeywordsHref="/keyword-research?from=strategy"
      nextHref="/content?strategy=complete"
      initialTab="approved"
      initialReasons={{}}
      nextAction={{ code: "create_first_article", href: "/content#article-review-workspace", label: "Create your first article", description: "Turn the strongest approved keyword into this week’s first useful article." }}
      questId="quest-1"
      questStatus="todo"
    />);

    expect(html).toContain("5 of 5");
    expect(html).toContain("approved");
    expect(html).toContain("You do not need to approve or review all 25");
    expect(html).toContain("Build my three-month content plan");
    expect(html).toContain("three-month editorial calendar");
    expect(html).toContain("To Review");
    expect(html).toContain("Approved");
    expect(html).toContain("Declined");
    expect(html).toContain("In plan · tracking weekly");
    expect(html).toContain("Checked against your site:");
    expect(html).not.toContain("Decline unreviewed");
  });

  it("shows Claude's separate OBS and GSC evidence with an improvement diagnostic", () => {
    const html = renderToStaticMarkup(<KeywordStrategyReview
      auditId="audit-1"
      initialDecisions={{}}
      initialReasons={{}}
      initialTab="review"
      keywords={keywords.slice(0, 1)}
      moreKeywordsHref="/keyword-research?from=strategy"
      nextHref="/content?strategy=complete"
      nextAction={{ code: "review_keywords", href: "#keyword-strategy-tabs", label: "Review keyword recommendations", description: "Choose the searches that match the business." }}
      questId="quest-1"
      questStatus="todo"
    />);

    expect(html).toContain("Improve · quick wins");
    expect(html).toContain("OBS");
    expect(html).toContain("GSC");
    expect(html).toContain("13.2");
    expect(html).toContain("/services");
    expect(html).toContain("Re-optimize");
  });

  it("turns a completed strategy into a working summary with the next useful action", () => {
    const html = renderToStaticMarkup(<KeywordStrategyReview
      auditId="audit-1"
      initialDecisions={Object.fromEntries(keywords.map((keyword, index) => [keyword.keyword, index < 5 ? "approved" as const : "declined" as const]))}
      keywords={keywords}
      moreKeywordsHref="/keyword-research?from=strategy"
      nextHref="/content?strategy=complete"
      initialTab="approved"
      initialReasons={{}}
      nextAction={{ code: "create_first_article", href: "/content#article-review-workspace", label: "Create your first article", description: "Turn the strongest approved keyword into this week’s first useful article." }}
      questId="quest-1"
      questStatus="complete"
    />);

    expect(html).toContain('aria-label="Strategy summary"');
    expect(html).toContain("You’re all caught up");
    expect(html).toContain("Create your first article");
    expect(html).toContain("In your 12-week calendar");
    expect(html).toContain("Saved · restorable anytime");
    expect(html).toContain("Next step");
  });

  it("uses Claude's compact approved-keyword table and initially limits long lists to ten rows", () => {
    const approvedKeywords = keywords.slice(0, 12);
    const html = renderToStaticMarkup(<KeywordStrategyReview
      auditId="audit-1"
      initialDecisions={Object.fromEntries(approvedKeywords.map((keyword) => [keyword.keyword, "approved" as const]))}
      keywords={keywords}
      moreKeywordsHref="/keyword-research?from=strategy"
      nextHref="/content?strategy=complete"
      initialTab="approved"
      initialReasons={{}}
      nextAction={{ code: "create_first_article", href: "/content#article-review-workspace", label: "Create your first article", description: "Turn the strongest approved keyword into this week’s first useful article." }}
      questId="quest-1"
      questStatus="complete"
    />);

    expect(html).toContain("Monthly searches");
    expect(html).toContain("Opportunity");
    expect(html).toContain("Plan status");
    expect(html).toContain("Showing 10 of 12 approved keywords");
    expect(html).toContain("View all 12");
    expect(html).toContain("Unapprove");
    expect(html).toContain(approvedKeywords[9].keyword);
    expect(html).not.toContain(approvedKeywords[10].keyword);
  });

  it("explains the exact approval gap instead of showing a silent disabled finish button", () => {
    const html = renderToStaticMarkup(<KeywordStrategyReview
      auditId="audit-1"
      initialDecisions={Object.fromEntries(keywords.slice(0, 3).map((keyword) => [keyword.keyword, "approved" as const]))}
      keywords={keywords}
      moreKeywordsHref="/keyword-research?from=strategy"
      nextHref="/content?strategy=complete"
      initialTab="review"
      initialReasons={{}}
      nextAction={{ code: "review_keywords", href: "#keyword-strategy-tabs", label: "Review keyword recommendations", description: "Choose the searches that match the business." }}
      questId="quest-1"
      questStatus="todo"
    />);

    expect(html).toContain("3 of 5");
    expect(html).toContain("Approve 2 more to continue");
    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toMatch(/Approve 2 more to continue<\/button[^>]* disabled/);
  });

  it("keeps declined keywords visible with the reason and a reversible action", () => {
    const declinedKeyword = keywords[0].keyword;
    const html = renderToStaticMarkup(<KeywordStrategyReview
      auditId="audit-1"
      initialDecisions={{ [declinedKeyword]: "declined" }}
      initialReasons={{ [declinedKeyword]: "wrong_audience" }}
      initialTab="declined"
      keywords={keywords}
      moreKeywordsHref="/keyword-research?from=strategy"
      nextHref="/content?strategy=complete"
      nextAction={{ code: "review_keywords", href: "#keyword-strategy-tabs", label: "Review keyword recommendations", description: "Choose the searches that match the business." }}
      questId="quest-1"
      questStatus="todo"
    />);

    expect(html).toContain("Wrong audience");
    expect(html).toContain("Restore to review");
    expect(html).toContain(declinedKeyword);
    expect(html).not.toContain(keywords[1].keyword);
  });
});
