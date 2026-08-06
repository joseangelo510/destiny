import { afterEach, describe, expect, it, vi } from "vitest";
import { buildKeywordStrategy, DataForSeoProvider, mergeKeywordStrategy } from "./dataforseo-provider";
import type { SeoKeyword } from "./types";

function payload(result: unknown) {
  return { status_code: 20000, tasks: [{ status_code: 20000, result: [result] }] };
}

describe("DataForSeoProvider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("parses live provider metrics without making a network request", async () => {
    const responses = [
      payload({ items: [{ onpage_score: 81, checks: { no_title: true, no_h1_tag: false, small_page_size: true, is_https: true, has_html_doctype: true, canonical: true } }] }),
      payload({
        total_count: 33,
        metrics: { organic: { count: 33, is_new: 5, is_lost: 2, etv: 712.5 } },
        items: [{
          keyword_data: { keyword: "san francisco homes", keyword_info: { search_volume: 880, cpc: 4.2 }, keyword_properties: { main_intent: "commercial", keyword_difficulty: 39 } },
          ranked_serp_element: { serp_item: { rank_group: 12, url: "https://example.com/homes" } },
        }],
      }),
      payload({ items: [{ domain: "example.com", intersections: 33 }, { domain: "competitor.example", intersections: 17 }] }),
      payload({ items: [{ keyword: "san francisco family realtor", keyword_info: { search_volume: 260, cpc: 5.1 }, keyword_properties: { keyword_difficulty: 31 }, search_intent_info: { main_intent: "commercial" } }] }),
      payload({ items: [
        { year: 2026, month: 5, metrics: { organic: { etv: 600, count: 29, pos_1: 2, pos_2_3: 3, pos_4_10: 8, is_new: 3, is_lost: 1 } } },
        { year: 2026, month: 6, metrics: { organic: { etv: 680, count: 31, pos_1: 2, pos_2_3: 4, pos_4_10: 9, is_new: 4, is_lost: 1 } } },
        { year: 2026, month: 7, metrics: { organic: { etv: 712.5, count: 33, pos_1: 3, pos_2_3: 5, pos_4_10: 10, is_new: 5, is_lost: 2 } } },
      ] }),
      payload({ total_count: 24, items: [{ keyword_data: { keyword: "best neighborhoods for families", keyword_info: { search_volume: 590, cpc: 3.4 }, keyword_properties: { keyword_difficulty: 36 }, search_intent_info: { main_intent: "informational" } } }] }),
    ];
    const fetchMock = vi.fn(async () => Response.json(responses.shift()));
    vi.stubGlobal("fetch", fetchMock);

    const result = await new DataForSeoProvider("account@example.com", "api-password")
      .runAudit({ website: "https://example.com", locationName: "San Francisco,California,United States" });

    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      "https://api.dataforseo.com/v3/on_page/instant_pages",
      "https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live",
      "https://api.dataforseo.com/v3/dataforseo_labs/google/competitors_domain/live",
      "https://api.dataforseo.com/v3/dataforseo_labs/google/keywords_for_site/live",
      "https://api.dataforseo.com/v3/dataforseo_labs/google/historical_rank_overview/live",
      "https://api.dataforseo.com/v3/dataforseo_labs/google/domain_intersection/live",
    ]);
    expect(result.source).toBe("dataforseo");
    expect(result.metrics).toMatchObject({
      criticalIssues: 1,
      rankingKeywords: 33,
      newKeywords: 5,
      lostKeywords: 2,
      estimatedOrganicTraffic: 712.5,
      contentGaps: 1,
      onPageScore: 81,
    });
    expect(result.competitors).toEqual([{ domain: "competitor.example", sharedKeywords: 17 }]);
    expect(result.historicalPerformance?.map((point) => [point.month, point.organicTraffic, point.rankingKeywords])).toEqual([
      [5, 600, 29], [6, 680, 31], [7, 712.5, 33],
    ]);
    expect(result.issues).toEqual([
      { code: "no_title", label: "Page title is missing", severity: "critical" },
      { code: "small_page_size", label: "Page contains very little HTML content", severity: "warning" },
    ]);
    expect(result.keywords).toEqual([
      { keyword: "san francisco homes", rank: 12, searchVolume: 880, url: "https://example.com/homes", intent: "commercial", difficulty: 39, cpc: 4.2, opportunity: "existing_rank" },
      { keyword: "best neighborhoods for families", rank: 0, searchVolume: 590, url: "", intent: "informational", difficulty: 36, cpc: 3.4, opportunity: "competitor_gap" },
      { keyword: "san francisco family realtor", rank: 0, searchVolume: 260, url: "", intent: "commercial", difficulty: 31, cpc: 5.1, opportunity: "site_idea" },
    ]);
  });

  it("interleaves strategy sources, removes duplicate keywords, and respects the limit", () => {
    const keyword = (name: string, opportunity: SeoKeyword["opportunity"]): SeoKeyword => ({
      keyword: name, rank: 0, searchVolume: 10, url: "", intent: "informational", difficulty: 20, cpc: 1, opportunity,
    });
    expect(mergeKeywordStrategy([
      [keyword("Alpha", "existing_rank"), keyword("Beta", "existing_rank")],
      [keyword("alpha", "competitor_gap"), keyword("Gamma", "competitor_gap")],
      [keyword("Delta", "site_idea")],
    ], 3).map((item) => item.keyword)).toEqual(["Alpha", "Delta", "Beta"]);
  });

  it("collapses punctuation and plural variants and excludes address-only noise", () => {
    const keyword = (name: string): SeoKeyword => ({
      keyword: name, rank: 1, searchVolume: 40, url: "", intent: "informational", difficulty: 0, cpc: 0, opportunity: "existing_rank",
    });
    expect(mergeKeywordStrategy([[
      keyword("0 3 month nike shoes"),
      keyword("0-3 months nike shoes"),
      keyword("0-3 month nike outfit"),
      keyword("0-3 months nike outfits"),
      keyword("1 Bowerman Drive Beaverton Oregon 97005 United States"),
    ]]).map((item) => item.keyword)).toEqual([
      "0 3 month nike shoes",
      "0-3 month nike outfit",
    ]);
  });

  it("prioritizes keywords that match the saved business context", () => {
    const keyword = (name: string, opportunity: SeoKeyword["opportunity"]): SeoKeyword => ({
      keyword: name, rank: 0, searchVolume: 10, url: "", intent: "informational", difficulty: 20, cpc: 1, opportunity,
    });
    const result = buildKeywordStrategy([
      [keyword("history of a cereal mascot", "existing_rank"), keyword("youtube seo agency", "existing_rank")],
      [keyword("gmail sign in and login", "competitor_gap"), keyword("seo strategy for founders", "competitor_gap")],
      [keyword("digital marketing audit", "site_idea")],
    ], { productsServices: "SEO and digital marketing strategy", idealCustomer: "startup founders" }, 3);
    expect(result.map((item) => item.keyword)).toEqual([
      "youtube seo agency",
      "seo strategy for founders",
      "digital marketing audit",
    ]);
  });

  it("surfaces a provider task error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({
      status_code: 20000,
      tasks: [{ status_code: 40201, status_message: "Insufficient funds", result: [] }],
    })));

    await expect(new DataForSeoProvider("account@example.com", "api-password")
      .runAudit({ website: "example.com" })).rejects.toThrow("Insufficient funds");
  });
});
