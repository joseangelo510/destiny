import { describe, expect, it, vi } from "vitest";
import { buildReoptimizationManifest, fetchReoptimizationPage, renderReoptimizationWordDocument } from "./reoptimization-document";
import { REOPTIMIZATION_CHECKLIST, type ReoptimizationStrategy } from "./reoptimization-strategy";
import type { ReoptimizationResearchResult } from "./research";

const evidence = {
  auditId: "audit-1", websiteId: "site-1", keyword: "youtube ad agency",
  pageUrl: "https://joseangelostudios.com/youtube-ads-agency/", businessName: "Jose Angelo Studios",
  productsServices: "YouTube advertising and video marketing services", idealCustomer: "founder-led businesses",
  searchVolume: 260, rank: 13, gscPosition: 13.2, gscImpressions: 1850, gscClicks: 12,
};

const research: ReoptimizationResearchResult = {
  sourceLabel: "Live DataForSEO re-optimization evidence", keyword: evidence.keyword, pageUrl: evidence.pageUrl,
  location: "United States", updatedAt: "2026-08-12T20:01:00.000Z", providerCost: 0.08,
  serp: { organic: [], peopleAlsoAsk: [], relatedSearches: [], features: [] },
  currentPage: { title: "YouTube Ads Agency | Drive Business Growth", description: "Current description", headings: ["YouTube Advertising Agency", "Services"], headingStructure: [{ level: 1, text: "YouTube Advertising Agency" }, { level: 2, text: "Services" }], text: "Drive business growth with targeted YouTube campaigns.", wordCount: 8, links: [] },
  competitorPages: [], queries: { currentRankings: [], related: [] }, onPage: { score: 82, checks: [], loadTimeMs: 1_400, sizeBytes: 12_345 },
  backlinks: { rank: 190, backlinks: 12, referringDomains: 7, brokenBacklinks: 1 }, notices: [],
};

const strategy: ReoptimizationStrategy = {
  verdict: "expand", verdictLabel: "Expand the existing service page",
  summary: "The page matches the query but needs stronger decision-stage proof.",
  primaryGoal: "Improve qualified inquiries without sacrificing the ranking URL.", preserve: ["Keep the current URL."],
  keywordFramework: {
    primary: "youtube ad agency",
    secondary: ["youtube advertising agency", "youtube ads services"],
    related: ["youtube ad strategy", "youtube video ad production", "youtube campaign management"],
  },
  headingPlan: {
    summary: "Keep one H1 and organize the service details under descriptive H2 and H3 sections.",
    recommended: [
      { level: "H1", text: "YouTube Ads Agency", purpose: "Name the service.", source: "revised" },
      { level: "H2", text: "YouTube Ads services", purpose: "Group the offer.", source: "revised" },
      { level: "H3", text: "Campaign strategy", purpose: "Describe a service component.", source: "new" },
    ],
  },
  headingDecisions: [
    { action: "replace", existingLevel: "H1", existingText: "YouTube Advertising Agency", recommendedLevel: "H1", recommendedText: "YouTube Ad Agency for Strategy and Growth", rationale: "Lead with the primary phrase." },
    { action: "replace", existingLevel: "H2", existingText: "Services", recommendedLevel: "H2", recommendedText: "YouTube Ads Services", rationale: "Use a secondary commercial phrase." },
    { action: "add", existingLevel: null, existingText: "", recommendedLevel: "H3", recommendedText: "YouTube Video Ad Production", rationale: "Cover a verified related service." },
  ],
  checklist: REOPTIMIZATION_CHECKLIST.map(({ id }) => ({
    id,
    status: id === "conversion" ? "opportunity" as const : "pass" as const,
    priority: id === "conversion" ? "high" as const : "low" as const,
    finding: id === "conversion" ? "The verified page copy does not explain the engagement process." : "No evidence-backed change is required.",
    action: id === "conversion" ? "Add an engagement-process section" : "Preserve and monitor",
    current: id === "conversion" ? "No engagement-process section appears in the parsed headings." : "Verified current state is acceptable.",
    recommended: id === "conversion" ? "Add a short four-step section covering discovery, campaign setup, optimization, and reporting." : "No replacement proposed.",
    where: id === "conversion" ? "Below the service overview and above proof." : "No CMS edit.",
    evidence: [{ source: "Current page" as const, detail: "Parsed page headings and text were reviewed.", url: evidence.pageUrl }],
  })),
  measurementPlan: ["Record the current ranking, impressions, clicks, and conversions before editing.", "Review at 14, 30, and 60 days."],
};

const snapshot = {
  state: "fetched" as const, fetchedAt: "2026-08-12T20:00:00.000Z",
  title: "YouTube Ads Agency | Drive Business Growth", metaDescription: "Current description",
  h1: "YouTube Advertising Agency", firstParagraph: "Drive business growth with targeted YouTube campaigns.", hasFaq: false,
};

describe("re-optimization change documents", () => {
  it("includes only evidence-backed opportunities as implementation changes", () => {
    const manifest = buildReoptimizationManifest(evidence, snapshot, research, strategy, "doc-1");
    expect(manifest.strategy.verdict).toBe("expand");
    expect(manifest.changes).toHaveLength(1);
    expect(manifest.changes[0]).toEqual(expect.objectContaining({ id: "conversion", priority: "high" }));
    expect(manifest.changes[0].evidence[0].source).toBe("Current page");
    expect(manifest.warning).toBeNull();
  });

  it("labels an unreadable page instead of treating it as independently verified", () => {
    const manifest = buildReoptimizationManifest(evidence, { ...snapshot, state: "unverified", title: null, metaDescription: null, h1: null, firstParagraph: null }, research, strategy, "doc-2");
    expect(manifest.warning).toContain("couldn’t independently fetch the live page");
  });

  it("fetches only the verified website host and extracts live elements", async () => {
    const fetcher = vi.fn(async () => new Response("<!doctype html><html><head><title>Current title</title><meta content=\"Current description\" name=\"description\"></head><body><h1>Current H1</h1><p>Current first useful paragraph.</p></body></html>", { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }));
    const result = await fetchReoptimizationPage({ pageUrl: evidence.pageUrl, websiteUrl: "https://joseangelostudios.com", fetcher, resolveHost: async () => ["93.184.216.34"], fetchedAt: snapshot.fetchedAt });
    expect(result).toEqual(expect.objectContaining({ state: "fetched", title: "Current title", metaDescription: "Current description", h1: "Current H1", firstParagraph: "Current first useful paragraph." }));
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("refuses a ranking URL from another host before fetching", async () => {
    const fetcher = vi.fn();
    const result = await fetchReoptimizationPage({ pageUrl: "https://attacker.example/private", websiteUrl: "https://joseangelostudios.com", fetcher, resolveHost: async () => ["93.184.216.34"], fetchedAt: snapshot.fetchedAt });
    expect(result.state).toBe("unverified");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("renders a readable Word-compatible document with no Markdown scaffolding", () => {
    const html = renderReoptimizationWordDocument(buildReoptimizationManifest(evidence, snapshot, research, strategy, "doc-3"));
    expect(html).toContain("Your YouTube Ad Agency Page Update Plan");
    expect(html).toContain("Keyword coverage");
    expect(html).toContain("Primary — youtube ad agency");
    expect(html).toContain("Secondary — youtube advertising agency, youtube ads services");
    expect(html).toContain("Related — youtube ad strategy, youtube video ad production, youtube campaign management");
    expect(html).toContain("<th>Action</th><th>Existing heading</th><th>Recommended heading</th>");
    expect(html).toContain("H2 — YouTube Ads Services");
    expect(html).toContain("3. Other page changes");
    expect(html).toContain("4. Your next step");
    expect(html).not.toContain("Master re-optimization checklist");
    expect(html).not.toContain("Methodology applied");
    expect(html).not.toContain("Appendix");
    expect(html).not.toMatch(/(^|>)#{1,6}\s/m);
  });

  it("uses the same approved format for a second keyword", () => {
    const secondEvidence = { ...evidence, keyword: "youtube seo experts", pageUrl: "https://joseangelostudios.com/youtube-seo-experts/", searchVolume: 90, rank: 9 };
    const secondResearch = {
      ...research,
      keyword: secondEvidence.keyword,
      pageUrl: secondEvidence.pageUrl,
      currentPage: { ...research.currentPage, title: "YouTube SEO Experts", headings: ["YouTube SEO Experts", "YouTube SEO Services"], headingStructure: [{ level: 1 as const, text: "YouTube SEO Experts" }, { level: 2 as const, text: "YouTube SEO Services" }] },
    };
    const secondStrategy: ReoptimizationStrategy = {
      ...strategy,
      keywordFramework: { primary: "youtube seo experts", secondary: ["youtube seo agency", "youtube seo services"], related: ["youtube channel optimization", "youtube keyword research", "video seo strategy"] },
      headingDecisions: [
        { action: "keep", existingLevel: "H1", existingText: "YouTube SEO Experts", recommendedLevel: "H1", recommendedText: "YouTube SEO Experts", rationale: "The H1 already matches the focus query." },
        { action: "replace", existingLevel: "H2", existingText: "YouTube SEO Services", recommendedLevel: "H2", recommendedText: "YouTube SEO Services for Channel Growth", rationale: "Strengthen the secondary phrase without stuffing." },
        { action: "add", existingLevel: null, existingText: "", recommendedLevel: "H3", recommendedText: "YouTube Keyword Research and Video SEO Strategy", rationale: "Cover related services in the relevant section." },
      ],
    };
    const html = renderReoptimizationWordDocument(buildReoptimizationManifest(secondEvidence, { ...snapshot, title: "YouTube SEO Experts", h1: "YouTube SEO Experts" }, secondResearch, secondStrategy, "doc-4"));
    expect(html).toContain("Your YouTube SEO Experts Page Update Plan");
    expect(html).toContain("Primary — youtube seo experts");
    expect(html).toContain("Secondary — youtube seo agency, youtube seo services");
    expect(html).toContain("H3 — YouTube Keyword Research and Video SEO Strategy");
    expect((html.match(/<th>Action<\/th>/g) || [])).toHaveLength(1);
    expect(html).not.toContain("Appendix");
  });
});
