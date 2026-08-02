import { afterEach, describe, expect, it, vi } from "vitest";
import { runDataForSeoAudit } from "./seo";

function payload(result: unknown) {
  return { status_code: 20000, tasks: [{ status_code: 20000, result: [result] }] };
}

function keywordRow(keyword: string) {
  return { keyword_data: { keyword, keyword_info: { search_volume: 500, cpc: 4 }, keyword_properties: { keyword_difficulty: 31 }, search_intent_info: { main_intent: "commercial" } } };
}

describe("live audit orchestration", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses five-page evidence, two competitor gaps, real threads, and LLM citations", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const body = JSON.parse(String(init?.body || "[]"))[0] as Record<string, unknown>;
      if (url.endsWith("/on_page/instant_pages")) return Response.json(payload({ items: [{ onpage_score: 82, checks: {} }] }));
      if (url.endsWith("/ranked_keywords/live")) return Response.json(payload({ metrics: { organic: { count: 12, is_new: 2, is_lost: 0, etv: 440 } }, items: [] }));
      if (url.endsWith("/competitors_domain/live")) return Response.json(payload({ items: [{ domain: "competitor-one.com", intersections: 12 }, { domain: "competitor-two.com", intersections: 9 }] }));
      if (url.endsWith("/keywords_for_site/live")) return Response.json(payload({ items: [{ keyword: "college admissions counseling", keyword_info: { search_volume: 500, cpc: 4 }, keyword_properties: { keyword_difficulty: 31 }, search_intent_info: { main_intent: "commercial" } }] }));
      if (url.endsWith("/on_page/content_parsing/live")) {
        const pageUrl = String(body.url);
        const markdown = pageUrl.endsWith("/services")
          ? "# College admissions services\nPersonal admissions counseling and application coaching."
          : "# College admissions counseling\nExpert college admissions counseling for families.\n[Services](https://example.com/services)";
        return Response.json(payload({ items: [{ page_as_markdown: markdown }] }));
      }
      if (url.endsWith("/domain_intersection/live")) return Response.json(payload({ items: [keywordRow("college admissions counseling")] }));
      if (url.endsWith("/serp/google/organic/live/advanced")) {
        const reddit = String(body.keyword).startsWith("reddit");
        return Response.json(payload({ items: [{ type: "organic", title: reddit ? "How did you choose a counselor?" : "What does an admissions counselor do?", url: reddit ? "https://www.reddit.com/r/ApplyingToCollege/comments/abc123/example/" : "https://www.quora.com/What-does-an-admissions-counselor-do", description: "A current community question." }] }));
      }
      if (url.endsWith("/llm_mentions/target_metrics/live")) return Response.json(payload({ aggregated_metrics: { platform: [{ key: "chat_gpt", mentions: 3, ai_search_volume: 90 }], sources_domain: [{ key: "example.edu", mentions: 7, ai_search_volume: 140 }] } }));
      throw new Error(`Unexpected DataForSEO URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await runDataForSeoAudit("https://example.com", "United States", "login", "password", {
      productsServices: "College admissions counseling and application coaching",
      idealCustomer: "Families with high school students",
    });

    expect(result.pages?.map((page) => page.role)).toEqual(["homepage", "product"]);
    expect(result.siteVocabulary?.some((term) => term.normalized === "college admission")).toBe(true);
    expect(result.keywords.find((keyword) => keyword.keyword === "college admissions counseling")).toMatchObject({ competitorRankers: 2, verdict: "accept", essential: true, ruleId: "essential_gap" });
    expect(result.distributionOpportunities?.map((item) => item.platform)).toEqual(["Reddit", "Quora"]);
    expect(result.llmVisibility).toMatchObject({ status: "available", totalMentions: 3, topCitedDomains: [{ domain: "example.edu" }] });
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/domain_intersection/live"))).toHaveLength(2);
  });
});
