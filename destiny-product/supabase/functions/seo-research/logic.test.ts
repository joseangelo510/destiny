import { describe, expect, it } from "vitest";
import { creatorSearchRequests, organicHistoryWindowStart, parseArticleEvidence, parseCreatorSearchResults, parseOrganicPerformance } from "./logic";

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
