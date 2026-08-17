import { describe, expect, it } from "vitest";
import { parseReoptimizationResearch } from "./research";

const payload = (result: Record<string, unknown>, cost = 0.01) => ({
  status_code: 20000,
  tasks: [{ status_code: 20000, cost, result: [result] }],
});

describe("DataForSEO re-optimization research", () => {
  it("combines current-page, SERP, competitor, technical, and backlink evidence", () => {
    const result = parseReoptimizationResearch({
      keyword: "youtube ad agency",
      pageUrl: "https://joseangelostudios.com/youtube-ads-agency/",
      location: "United States",
      serpPayload: payload({ items: [
        { type: "organic", rank_group: 1, title: "Competitor guide", url: "https://competitor.example/youtube-ads", description: "A detailed guide" },
        { type: "organic", rank_group: 13, title: "Jose Angelo Studios", url: "https://joseangelostudios.com/youtube-ads-agency/", description: "Agency services" },
        { type: "people_also_ask", items: [{ title: "How much does a YouTube ad agency cost?" }] },
        { type: "related_searches", items: [{ title: "best youtube ad agency" }] },
        { type: "featured_snippet" },
      ] }, 0.02),
      currentPayload: payload({ items: [{ meta: { title: "Current title", description: "Current description" }, page_as_markdown: "# Current H1\n\n## Current proof\n\n##### Proof card title\n\nUseful page copy." }] }),
      instantPayload: payload({ items: [{ onpage_score: 82, checks: { duplicate_title: true, no_h1_tag: false }, page_timing: { duration_time: 1400 }, size: 12345 }] }),
      backlinksPayload: payload({ rank: 190, backlinks: 12, referring_domains: 7, broken_backlinks: 1 }, 0.03),
      competitorPayloads: [payload({ items: [{ meta: { title: "Competitor title" }, page_as_markdown: "# Competitor H1\n\n## Pricing\n\n## Case studies\n\nCompetitor text." }] })],
      competitorBacklinkPayloads: [payload({ rank: 240, referring_domains: 18 }, 0.01)],
    });

    expect(result.currentPage.title).toBe("Current title");
    expect(result.currentPage.headings).toEqual(["Current H1", "Current proof", "Proof card title"]);
    expect(result.currentPage.headingStructure).toEqual([
      { level: 1, text: "Current H1" },
      { level: 2, text: "Current proof" },
      { level: 5, text: "Proof card title" },
    ]);
    expect(result.serp.peopleAlsoAsk).toContain("How much does a YouTube ad agency cost?");
    expect(result.serp.relatedSearches).toContain("best youtube ad agency");
    expect(result.serp.features).toContain("featured_snippet");
    expect(result.competitorPages[0]).toEqual(expect.objectContaining({
      rank: 1,
      domain: "competitor.example",
      headings: ["Competitor H1", "Pricing", "Case studies"],
      headingStructure: [
        { level: 1, text: "Competitor H1" },
        { level: 2, text: "Pricing" },
        { level: 2, text: "Case studies" },
      ],
      backlinkRank: 240,
      referringDomains: 18,
    }));
    expect(result.onPage).toEqual(expect.objectContaining({ score: 82, checks: ["duplicate_title"], loadTimeMs: 1400 }));
    expect(result.backlinks).toEqual({ rank: 190, backlinks: 12, referringDomains: 7, brokenBacklinks: 1 });
    expect(result.providerCost).toBeCloseTo(0.09, 5);
  });
});
