import { describe, expect, it } from "vitest";
import {
  parseBacklinkResearch,
  parseKeywordResearch,
  summarizeKeywordResearch,
} from "./research";

const successfulPayload = (result: Record<string, unknown>) => ({
  status_code: 20000,
  tasks: [{ status_code: 20000, result: [result] }],
});

describe("advanced SEO research parsers", () => {
  it("normalizes keyword suggestions and preserves intent, demand, difficulty, and trend", () => {
    const rows = parseKeywordResearch(successfulPayload({
      total_count: 2,
      items: [{
        keyword: "college admissions consultant",
        keyword_info: {
          search_volume: 1900,
          cpc: 8.45,
          competition: 0.72,
          monthly_searches: [{ year: 2026, month: 6, search_volume: 1800 }, { year: 2026, month: 7, search_volume: 2000 }],
        },
        keyword_properties: { keyword_difficulty: 61 },
        search_intent_info: { main_intent: "commercial" },
      }],
    }));

    expect(rows).toEqual([expect.objectContaining({
      keyword: "college admissions consultant",
      intent: "commercial",
      volume: 1900,
      difficulty: 61,
      cpc: 8.45,
      competition: 0.72,
      trend: [1800, 2000],
    })]);
    expect(summarizeKeywordResearch(rows, 2)).toEqual({
      totalKeywords: 2,
      totalVolume: 1900,
      averageDifficulty: 61,
      estimatedTraffic: 0,
    });
  });

  it("normalizes ranked domain keywords including position, traffic, and ranking URL", () => {
    const rows = parseKeywordResearch(successfulPayload({
      items: [{
        keyword_data: {
          keyword: "college counselor",
          keyword_info: { search_volume: 2900, cpc: 5.2, competition: 0.48 },
          keyword_properties: { keyword_difficulty: 48 },
          search_intent_info: { main_intent: "commercial" },
        },
        ranked_serp_element: { serp_item: { rank_group: 7, url: "https://example.com/services", etv: 82 } },
      }],
    }));

    expect(rows[0]).toEqual(expect.objectContaining({
      keyword: "college counselor",
      position: 7,
      traffic: 82,
      url: "https://example.com/services",
    }));
  });

  it("combines backlink summary and link rows without confusing backlinks with referring domains", () => {
    const result = parseBacklinkResearch(
      successfulPayload({
        rank: 412,
        backlinks: 1840,
        referring_domains: 233,
        referring_pages: 711,
        referring_ips: 201,
        broken_backlinks: 29,
        spam_score: 4,
        referring_links_types: { anchor: 1700, image: 140 },
        referring_links_attributes: { dofollow: 1260, nofollow: 580 },
      }),
      successfulPayload({
        total_count: 1,
        items: [{
          domain_from: "publisher.example",
          url_from: "https://publisher.example/guide",
          url_to: "https://example.com/services",
          anchor: "admissions advice",
          domain_from_rank: 534,
          page_from_rank: 377,
          dofollow: true,
          first_seen: "2026-01-10 10:00:00 +00:00",
          last_seen: "2026-07-28 10:00:00 +00:00",
          type: "anchor",
        }],
      }),
      "example.com",
    );

    expect(result.summary).toEqual(expect.objectContaining({
      domainRank: 412,
      backlinks: 1840,
      referringDomains: 233,
      referringPages: 711,
      referringIps: 201,
      brokenBacklinks: 29,
      spamScore: 4,
    }));
    expect(result.rows[0]).toEqual(expect.objectContaining({
      sourceDomain: "publisher.example",
      anchor: "admissions advice",
      dofollow: true,
      status: "live",
    }));
    expect(result.linkTypes).toEqual([{ label: "Text", value: 1700 }, { label: "Image", value: 140 }]);
  });

  it("surfaces provider failures instead of returning an empty report", () => {
    expect(() => parseKeywordResearch({
      status_code: 20000,
      tasks: [{ status_code: 40501, status_message: "Invalid field" }],
    })).toThrow("Invalid field");
  });
});
