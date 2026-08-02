import { afterEach, describe, expect, it, vi } from "vitest";
import { buildContextSeedKeywords, dataForSeoPost, runDataForSeoAudit } from "./seo";

function payload(result: unknown) {
  return { status_code: 20000, tasks: [{ status_code: 20000, result: [result] }] };
}

function keywordRow(keyword: string) {
  return { keyword_data: { keyword, keyword_info: { search_volume: 500, cpc: 4 }, keyword_properties: { keyword_difficulty: 31 }, search_intent_info: { main_intent: "commercial" } } };
}

describe("live audit orchestration", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("settles a provider request even when fetch ignores abort signals", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => undefined)));

    const pending = dataForSeoPost("/v3/example", [{}], "login", "password", 50)
      .then(() => "resolved", (cause: unknown) => cause instanceof Error ? cause.message : "rejected");
    await vi.advanceTimersByTimeAsync(51);
    const outcome = await Promise.race([pending, Promise.resolve("still pending")]);

    expect(outcome).toContain("timed out");
    vi.useRealTimers();
  });

  it("turns onboarding evidence into deterministic site-foundation keyword candidates", () => {
    expect(buildContextSeedKeywords({
      productsServices: "Online graphic design, presentations, social media graphics, video editing tools, and brand templates",
      idealCustomer: "Small business marketing teams",
      market: "United States",
    }, 8).map((keyword) => keyword.keyword)).toEqual([
      "online graphic design",
      "social media graphics",
      "video editing tools",
      "brand templates",
    ]);
  });

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

    const progress: number[] = [];
    const result = await runDataForSeoAudit("https://example.com", "United States", "login", "password", {
      productsServices: "College admissions counseling and application coaching",
      idealCustomer: "Families with high school students",
    }, [], async (value) => { progress.push(value); });

    expect(result.pages?.map((page) => page.role)).toEqual(["homepage", "product", "how_it_works", "about", "contact"]);
    expect(result.siteVocabulary?.some((term) => term.normalized === "college admission")).toBe(true);
    expect(result.keywords.find((keyword) => keyword.keyword === "college admissions counseling")).toMatchObject({ competitorRankers: 2, verdict: "accept", essential: true, ruleId: "essential_gap" });
    expect(result.distributionOpportunities?.map((item) => item.platform)).toEqual(["Reddit", "Quora"]);
    expect(result.llmVisibility).toMatchObject({ status: "available", totalMentions: 3, topCitedDomains: [{ domain: "example.edu" }] });
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/domain_intersection/live"))).toHaveLength(2);
    const gapRequests = fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/domain_intersection/live"));
    expect(gapRequests.every(([, init]) => JSON.parse(String(init?.body || "[]"))[0].limit === 300)).toBe(true);
    expect(gapRequests.every(([, init]) => JSON.stringify(JSON.parse(String(init?.body || "[]"))[0].filters).includes("keyword_data.keyword"))).toBe(true);
    expect(gapRequests.every(([, init]) => JSON.stringify(JSON.parse(String(init?.body || "[]"))[0].filters).includes("%college admission%"))).toBe(true);
    expect(progress).toEqual([30, 45, 65, 80, 90]);
    const calledUrls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(calledUrls.indexOf(calledUrls.find((url) => url.endsWith("/llm_mentions/target_metrics/live")) ?? "missing"))
      .toBeLessThan(calledUrls.indexOf(calledUrls.find((url) => url.endsWith("/domain_intersection/live")) ?? "missing"));
  });

  it("keeps provider noise rejected while retaining an honest site-foundation topic", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const body = JSON.parse(String(init?.body || "[]"))[0] as Record<string, unknown>;
      if (url.endsWith("/on_page/instant_pages")) return Response.json(payload({ items: [{ onpage_score: 79, checks: {} }] }));
      if (url.endsWith("/ranked_keywords/live")) return Response.json(payload({ metrics: { organic: { count: 0, is_new: 0, is_lost: 0, etv: 0 } }, items: [] }));
      if (url.endsWith("/competitors_domain/live")) return Response.json(payload({ items: [{ domain: "competitor-one.com", intersections: 5 }, { domain: "competitor-two.com", intersections: 4 }] }));
      if (url.endsWith("/keywords_for_site/live")) return Response.json(payload({ items: [{ keyword: "map of globe", keyword_info: { search_volume: 900 }, keyword_properties: {} }] }));
      if (url.endsWith("/on_page/content_parsing/live")) {
        const pageUrl = String(body.url);
        const markdown = pageUrl.endsWith("/") ? "# Graphic design platform\nCreate presentations and social media graphics.\n[Services](https://example.com/services)" : "# Design services\nOnline graphic design and video editing tools.";
        return Response.json(payload({ items: [{ page_as_markdown: markdown }] }));
      }
      if (url.endsWith("/domain_intersection/live")) return Response.json(payload({ items: [keywordRow("chevrons")] }));
      if (url.endsWith("/serp/google/organic/live/advanced")) return Response.json(payload({ items: [] }));
      if (url.endsWith("/llm_mentions/target_metrics/live")) return Response.json(payload({ aggregated_metrics: { platform: [], sources_domain: [] } }));
      throw new Error(`Unexpected DataForSEO URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await runDataForSeoAudit("https://example.com", "United States", "login", "password", {
      productsServices: "Online graphic design, presentations, social media graphics, video editing tools",
      idealCustomer: "Small business marketing teams",
    });

    expect(result.keywords.find((keyword) => keyword.keyword === "online graphic design")).toMatchObject({
      opportunity: "site_idea",
      verdict: "accept",
      ruleId: "site_vocabulary_match",
      essential: false,
    });
    expect(result.keywords.find((keyword) => keyword.keyword === "chevrons")?.verdict).toBe("reject");
    expect(result.keywords.findIndex((keyword) => keyword.keyword === "online graphic design"))
      .toBeLessThan(result.keywords.findIndex((keyword) => keyword.keyword === "map of globe"));
    expect(result.keywords.some((keyword) => keyword.essential)).toBe(false);
  });
});
