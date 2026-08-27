import { describe, expect, it } from "vitest";
import { classifyPageType, creatorSearchRequests, organicHistoryWindowStart, parseArticleEvidence, parseCreatorSearchResults, parseKeywordSerp, parseOrganicPerformance } from "./logic";

const successfulPayload = (items: unknown[]) => ({
  status_code: 20000,
  tasks: [{ status_code: 20000, result: [{ items }] }],
});

describe("organic performance history", () => {
  it("requests enough calendar history to return three completed monthly points", () => {
    expect(organicHistoryWindowStart(new Date("2026-08-03T15:00:00Z"))).toBe("2026-05-01");
  });

  it("returns the latest three months in chronological order with traffic and ranking coverage", () => {
    const points = parseOrganicPerformance(successfulPayload([
      { year: 2026, month: 8, metrics: { organic: { etv: 145.8, count: 72, pos_1: 3, pos_2_3: 7, pos_4_10: 15 } } },
      { year: 2026, month: 6, metrics: { organic: { etv: 91.1, count: 49, pos_1: 1, pos_2_3: 4, pos_4_10: 9 } } },
      { year: 2026, month: 7, metrics: { organic: { etv: 118.4, count: 61, pos_1: 2, pos_2_3: 5, pos_4_10: 12 } } },
      { year: 2026, month: 5, metrics: { organic: { etv: 70, count: 40 } } },
    ]));

    expect(points).toEqual([
      { date: "2026-06-01", traffic: 91, keywords: 49, top3: 5, top10: 14 },
      { date: "2026-07-01", traffic: 118, keywords: 61, top3: 7, top10: 19 },
      { date: "2026-08-01", traffic: 146, keywords: 72, top3: 10, top10: 25 },
    ]);
  });

  it("rejects provider failures instead of drawing invented history", () => {
    expect(() => parseOrganicPerformance({ status_code: 20000, tasks: [{ status_code: 40501, status_message: "Invalid target" }] })).toThrow("Invalid target");
  });
});

describe("creator discovery", () => {
  it("builds one bounded, platform-specific research request per source", () => {
    expect(creatorSearchRequests(["college admissions counseling", "essay coaching"])).toEqual([
      expect.objectContaining({ keyword: "college admissions counseling site:medium.com" }),
      expect.objectContaining({ keyword: "college admissions counseling site:youtube.com" }),
      expect.objectContaining({ keyword: "college admissions counseling site:linkedin.com" }),
      expect.objectContaining({ keyword: "college admissions counseling site:instagram.com" }),
      expect.objectContaining({ keyword: "college admissions counseling independent blog" }),
    ]);
  });

  it("keeps niche creator sources, excludes competitors and major media, and never invents audience size", () => {
    const payload = {
      status_code: 20000,
      tasks: [
        { status_code: 20000, data: { keyword: "junk removal site:youtube.com" }, result: [{ items: [
          { type: "organic", title: "Local cleanup tips — Small Hauler", url: "https://youtube.com/watch?v=abc", description: "Practical cleanup advice" },
          { type: "organic", title: "Competitor", url: "https://competitor.example/blog", description: "Competing company" },
        ] }] },
        { status_code: 20000, data: { keyword: "junk removal independent blog" }, result: [{ items: [
          { type: "organic", title: "Major media", url: "https://forbes.com/sites/example", description: "Too broad" },
          { type: "organic", title: "Reference result", url: "https://en.wikipedia.org/wiki/Junk_removal", description: "Not an outreach prospect" },
          { type: "organic", title: "Marketplace result", url: "https://amazon.com/example", description: "Not a creator" },
          { type: "organic", title: "Mass media result", url: "https://news.yahoo.com/example", description: "Not niche" },
          { type: "organic", title: "Community result", url: "https://reddit.com/r/example", description: "Belongs in community distribution" },
          { type: "organic", title: "Bay Area moving notes", url: "https://localmovingwriter.example/junk-guide", description: "Niche local article" },
        ] }] },
      ],
    };
    expect(parseCreatorSearchResults(payload, ["competitor.example"])).toEqual([
      expect.objectContaining({ platform: "YouTube", audienceEstimate: null, audienceVerification: "required" }),
      expect.objectContaining({ platform: "Independent blog", domain: "localmovingwriter.example", audienceEstimate: null }),
    ]);
  });
});

describe("article evidence", () => {
  it("returns bounded, deduplicated organic sources with exact HTTPS URLs", () => {
    const rows = parseArticleEvidence(successfulPayload([
      { type: "organic", title: "Official guidance", url: "https://commission.europa.eu/guidance", description: "Article 50 guidance" },
      { type: "organic", title: "Duplicate", url: "https://commission.europa.eu/guidance", description: "Duplicate" },
      { type: "people_also_ask", title: "Not a source", url: "https://example.com/question" },
      { type: "organic", title: "Regulation", url: "https://eur-lex.europa.eu/legal-content", description: "Primary law" },
      { type: "organic", title: "Implementation notes", url: "https://digital-strategy.ec.europa.eu/policies", description: "Implementation context" },
    ]));
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual(expect.objectContaining({ publisher: "commission.europa.eu", url: "https://commission.europa.eu/guidance" }));
  });
});

describe("keyword SERP evidence", () => {
  it("returns bounded first-page competitors, questions, and related searches", () => {
    const snapshot = parseKeywordSerp(successfulPayload([
      { type: "organic", rank_group: 1, title: "YouTube Ads Agency", url: "https://agency.example/youtube-ads-agency" },
      { type: "organic", rank_group: 2, title: "YouTube ads guide", url: "https://publisher.example/blog/youtube-ads-guide" },
      { type: "people_also_ask", items: [{ title: "How much does a YouTube ads agency cost?" }, { title: "Are YouTube ads worth it?" }] },
      { type: "related_searches", items: [{ title: "best youtube advertising agency" }, { title: "youtube ads management services" }] },
    ]), "youtube ads agency", "United States", new Date("2026-08-27T18:00:00Z"));

    expect(snapshot).toEqual(expect.objectContaining({
      keyword: "youtube ads agency",
      location: "United States",
      checkedAt: "2026-08-27T18:00:00.000Z",
      questions: ["How much does a YouTube ads agency cost?", "Are YouTube ads worth it?"],
      related: ["best youtube advertising agency", "youtube ads management services"],
    }));
    expect(snapshot.organic).toEqual([
      expect.objectContaining({ position: 1, domain: "agency.example", pageType: "service_page" }),
      expect.objectContaining({ position: 2, domain: "publisher.example", pageType: "blog_post" }),
    ]);
  });

  it("uses truthful empty arrays when Google returns no questions or related searches", () => {
    const snapshot = parseKeywordSerp(successfulPayload([
      { type: "organic", rank_group: 1, title: "Homepage", url: "https://example.com/" },
    ]), "niche phrase", "United States");
    expect(snapshot.questions).toEqual([]);
    expect(snapshot.related).toEqual([]);
  });

  it("deduplicates and limits organic results to the first ten valid HTTPS pages", () => {
    const organic = Array.from({ length: 14 }, (_, index) => ({
      type: "organic",
      rank_group: index + 1,
      title: `Result ${index + 1}`,
      url: `https://example${index + 1}.com/page`,
    }));
    organic.splice(1, 0, { ...organic[0] });
    const snapshot = parseKeywordSerp(successfulPayload(organic), "example", "United States");
    expect(snapshot.organic).toHaveLength(10);
    expect(new Set(snapshot.organic.map((row) => row.url)).size).toBe(10);
  });

  it("classifies page types conservatively from public URL evidence", () => {
    expect(classifyPageType("https://example.com/", "Homepage")).toBe("homepage");
    expect(classifyPageType("https://example.com/blog/seo-guide", "SEO guide")).toBe("blog_post");
    expect(classifyPageType("https://example.com/services/youtube-ads", "YouTube advertising services")).toBe("service_page");
    expect(classifyPageType("https://shop.example.com/products/widget", "Widget")).toBe("product_page");
    expect(classifyPageType("https://shop.example.com/collections/widgets", "Widgets")).toBe("category_page");
    expect(classifyPageType("https://youtube.com/watch?v=abc", "Video")).toBe("video");
    expect(classifyPageType("https://example.com/about", "About us")).toBe("other");
  });

  it("rejects provider failures instead of fabricating a snapshot", () => {
    expect(() => parseKeywordSerp({ status_code: 20000, tasks: [{ status_code: 40501, status_message: "Invalid keyword" }] }, "keyword", "United States")).toThrow("Invalid keyword");
  });
});
