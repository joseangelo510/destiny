import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { KeywordStrategyReview } from "./keyword-strategy-review";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
const common = { websiteId: "website-1", auditId: "audit-1", initialReasons: {}, initialDecisions: {}, initialTab: "review" as const, moreKeywordsHref: "/keyword-research", nextHref: "/content", nextAction: { code: "review_keywords" as const, href: "#keyword-strategy-tabs", label: "Review", description: "Review keywords" } };
const keyword = { keyword: "youtube marketing strategy", searchVolume: 210, difficulty: 20, competitorRankers: 0, rank: 0, cpc: 2, opportunity: "site_idea", providerIntent: "informational" as const, searchIntent: "awareness" as const, priorityScore: 60, priorityReason: "Fits your YouTube marketing service", themeId: "youtube", themeLabel: "YouTube", themeRole: "awareness", essential: false, verdict: "create" as const, verdictDescription: "No matching page found in checked results", rankingUrl: "", rankingUrls: [], gscPosition: 0, gscImpressions: 0, gscClicks: 0 };
it("shows fifteen new rows with more discovery while the existing table keeps its own limit", () => {
  const options = Array.from({ length: 31 }, (_, i) => ({ ...keyword, keyword: `youtube topic ${i}` }));
  const existing = Array.from({ length: 12 }, (_, i) => ({ ...keyword, keyword: `existing topic ${i}`, verdict: "improve" as const, rank: 12 }));
  const html = renderToStaticMarkup(<KeywordStrategyReview {...common} keywords={[...options, ...existing]} />);
  expect(html.match(/aria-label="Show content angle/g)).toHaveLength(15);
  expect(html).toContain("Show 15 more");
  expect(html).toContain("View all 12");
  expect(html).toContain("Discover more recommendations");
  expect(html).toContain("discover=1");
});
describe("approved new keyword section design", () => {
  it("puts new recommendations above existing opportunities in the same compact tables", () => {
    const html = renderToStaticMarkup(<KeywordStrategyReview {...common} keywords={[keyword, { ...keyword, keyword: "youtube agency", verdict: "improve", rank: 12, rankingUrl: "https://example.com/agency" }]} />);
    expect(html.indexOf("New keyword recommendations")).toBeLessThan(html.indexOf("Existing keyword opportunities"));
    expect(html.indexOf("youtube marketing strategy</strong>")).toBeLessThan(html.indexOf("Existing keyword opportunities"));
    expect(html.match(/<table>/g)).toHaveLength(2);
    expect(html).toContain(">Create content</button>");
    expect(html).toContain("Show content angle");
    expect(html).not.toContain("Pending / Checked on approve");
  });
  it("keeps declined recommendations out of the new section and gives an honest unavailable state", () => {
    const html = renderToStaticMarkup(<KeywordStrategyReview {...common} initialDecisions={{ [keyword.keyword]: "declined" }} newResearchStatus="unavailable" keywords={[keyword]} />);
    expect(html).toContain("temporarily unavailable");
    expect(html).not.toContain("youtube marketing strategy</strong>");
    expect(html).toContain('role="tab"');
  });
});
