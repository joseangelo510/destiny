import { afterEach, describe, expect, it, vi } from "vitest";
import { buildBuyerSeedKeywords, buildContextSeedKeywords, dataForSeoPost, parseHistoricalRankOverview, runDataForSeoAudit } from "./seo";

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

  it("allows slow live DataForSEO jobs up to the production request budget", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => undefined)));

    let settled = false;
    const pending = dataForSeoPost("/v3/example", [{}], "login", "password")
      .then(() => "resolved", (cause: unknown) => cause instanceof Error ? cause.message : "rejected")
      .finally(() => { settled = true; });

    await vi.advanceTimersByTimeAsync(15_001);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(45_000);
    await expect(pending).resolves.toContain("timed out after 60000ms");
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
      "small marketing teams",
    ]);
  });

  it("derives short service seeds for long-tail buyer keyword discovery", () => {
    expect(buildBuyerSeedKeywords({
      productsServices: "We provide college counseling services for high school students",
      problemSolved: "Families need trusted college admissions and application advice",
      idealCustomer: "High-achieving high school students",
    }, 4)).toEqual([
      "college counseling",
      "college counselor",
      "college admissions counseling",
      "college admissions counselor",
    ]);
  });

  it("keeps college-admissions context in every buyer seed and drops ambiguous application guidance", () => {
    const seeds = buildBuyerSeedKeywords({
      productsServices: "college counseling, admissions strategy, application guidance, and essay support for high school students",
      problemSolved: "Families need expert help navigating selective college admissions",
      idealCustomer: "Ambitious high school students and their families",
    }, 4);

    expect(seeds).toEqual([
      "college counseling",
      "college counselor",
      "college admissions counseling",
      "college admissions counselor",
    ]);
    expect(seeds).not.toContain("application guidance");
  });

  it("parses the provider's historical traffic and ranking keyword series", () => {
    expect(parseHistoricalRankOverview(payload({ items: [
      { year: 2026, month: 6, metrics: { organic: { etv: 140, count: 18, pos_1: 2, pos_2_3: 3, pos_4_10: 7, is_new: 4, is_lost: 1 } } },
      { year: 2026, month: 5, metrics: { organic: { etv: 120, count: 15, pos_1: 1, pos_2_3: 2, pos_4_10: 6, is_new: 3, is_lost: 2 } } },
    ] }))).toEqual([
      { year: 2026, month: 5, organicTraffic: 120, rankingKeywords: 15, top3Keywords: 3, top10Keywords: 9, newKeywords: 3, lostKeywords: 2 },
      { year: 2026, month: 6, organicTraffic: 140, rankingKeywords: 18, top3Keywords: 5, top10Keywords: 12, newKeywords: 4, lostKeywords: 1 },
    ]);
  });

  it("uses real strategic pages, broad intent-ready keyword evidence, competitor gaps, real threads, and LLM citations", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const body = JSON.parse(String(init?.body || "[]"))[0] as Record<string, unknown>;
      if (url.endsWith("/on_page/instant_pages")) return Response.json(payload({ items: [{ onpage_score: 82, checks: {} }] }));
      if (url.endsWith("/ranked_keywords/live")) return Response.json(payload({ metrics: { organic: { count: 12, is_new: 2, is_lost: 0, etv: 440 } }, items: [] }));
      if (url.endsWith("/competitors_domain/live")) return Response.json(payload({ items: [{ domain: "competitor-one.com", intersections: 12 }, { domain: "competitor-two.com", intersections: 9 }] }));
      if (url.endsWith("/keywords_for_site/live")) return Response.json(payload({ items: [{ keyword: "college admissions counseling", keyword_info: { search_volume: 500, cpc: 4 }, keyword_properties: { keyword_difficulty: 31 }, search_intent_info: { main_intent: "commercial" } }] }));
      if (url.endsWith("/keyword_ideas/live")) return Response.json(payload({ items: [
        { keyword: "college admissions consultant pricing", keyword_info: { search_volume: 1_300, cpc: 18 }, keyword_properties: { keyword_difficulty: 36 }, search_intent_info: { main_intent: "transactional" } },
        { keyword: "top colleges to get into", keyword_info: { search_volume: 8_100, cpc: 1 }, keyword_properties: { keyword_difficulty: 45 }, search_intent_info: { main_intent: "informational" } },
      ] }));
      if (url.endsWith("/keyword_suggestions/live")) return Response.json(payload({ items: [
        { keyword: "where to hire a private college counselor", keyword_info: { search_volume: 170, cpc: 22 }, keyword_properties: { keyword_difficulty: 31 } },
        { keyword: "best college counseling companies", keyword_info: { search_volume: 480, cpc: 19 }, keyword_properties: { keyword_difficulty: 39 } },
      ] }));
      if (url.endsWith("/search_intent/live")) {
        const keywords = Array.isArray(body.keywords) ? body.keywords as string[] : [];
        return Response.json(payload({ items: keywords.map((keyword) => ({
          keyword,
          keyword_intent: { label: /hire|pricing|companies/.test(keyword) ? "transactional" : /top colleges/.test(keyword) ? "informational" : "commercial", probability: 0.94 },
        })) }));
      }
      if (url.endsWith("/historical_rank_overview/live")) return Response.json(payload({ items: [
        { year: 2026, month: 5, metrics: { organic: { etv: 350, count: 9, pos_1: 1, pos_2_3: 1, pos_4_10: 3, is_new: 1, is_lost: 1 } } },
        { year: 2026, month: 6, metrics: { organic: { etv: 400, count: 10, pos_1: 1, pos_2_3: 2, pos_4_10: 4, is_new: 2, is_lost: 0 } } },
        { year: 2026, month: 7, metrics: { organic: { etv: 440, count: 12, pos_1: 2, pos_2_3: 2, pos_4_10: 5, is_new: 2, is_lost: 0 } } },
      ] }));
      if (url.endsWith("/on_page/content_parsing/live")) {
        const pageUrl = String(body.url);
        const markdown = pageUrl.endsWith("/services")
          ? "# College admissions services\nPersonal admissions counseling and application coaching."
          : "# College admissions counseling\nExpert college admissions counseling for families.\n[Services](https://example.com/services)";
        return Response.json(payload({ items: [{ page_as_markdown: markdown }] }));
      }
      if (url.endsWith("/domain_intersection/live")) return Response.json(payload({ items: [keywordRow("college admissions counseling")] }));
      if (url.endsWith("/serp/google/organic/live/advanced")) {
        const query = String(body.keyword);
        const reddit = query.startsWith("reddit");
        const quora = query.startsWith("quora");
        if (!reddit && !quora) return Response.json(payload({ items: [{ type: "organic", title: "Admissions industry guide", url: "https://educationpublisher.example/admissions-guide", description: "A non-competing publisher ranking for the keyword." }] }));
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

    expect(result.pages?.map((page) => page.role)).toEqual(["homepage", "product"]);
    expect(result.siteVocabulary?.some((term) => term.normalized === "college admission")).toBe(true);
    expect(result.keywords.find((keyword) => keyword.keyword === "college admissions counseling")).toMatchObject({ competitorRankers: 2, providerIntent: "commercial", searchIntent: "consideration" });
    expect(result.keywords.find((keyword) => keyword.keyword === "college admissions consultant pricing")?.priorityScore).toBeGreaterThan(
      result.keywords.find((keyword) => keyword.keyword === "top colleges to get into")?.priorityScore ?? 100,
    );
    expect(result.keywords.slice(0, 5).map((keyword) => keyword.keyword)).toEqual(expect.arrayContaining([
      "where to hire a private college counselor",
      "best college counseling companies",
    ]));
    expect(result.distributionOpportunities?.map((item) => item.platform)).toEqual(["Reddit", "Quora"]);
    expect(result.publisherOpportunities).toEqual([{ domain: "educationpublisher.example", title: "Admissions industry guide", url: "https://educationpublisher.example/admissions-guide", snippet: "A non-competing publisher ranking for the keyword.", keyword: "college admissions consultant pricing" }]);
    expect(result.llmVisibility).toMatchObject({ status: "available", totalMentions: 3, topCitedDomains: [{ domain: "example.edu" }] });
    expect(result.historicalPerformance?.map((point) => [point.month, point.organicTraffic, point.rankingKeywords])).toEqual([
      [5, 350, 9], [6, 400, 10], [7, 440, 12],
    ]);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/domain_intersection/live"))).toHaveLength(2);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/keyword_suggestions/live")).length).toBeGreaterThanOrEqual(1);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/search_intent/live"))).toHaveLength(1);
    const gapRequests = fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/domain_intersection/live"));
    expect(gapRequests.every(([, init]) => JSON.parse(String(init?.body || "[]"))[0].limit === 300)).toBe(true);
    expect(gapRequests.every(([, init]) => !JSON.stringify(JSON.parse(String(init?.body || "[]"))[0].filters).includes("keyword_data.keyword\""))).toBe(true);
    const rankedRequest = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/ranked_keywords/live"));
    const siteIdeasRequest = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/keywords_for_site/live"));
    expect(JSON.parse(String(rankedRequest?.[1]?.body || "[]"))[0].limit).toBeGreaterThanOrEqual(100);
    expect(JSON.parse(String(siteIdeasRequest?.[1]?.body || "[]"))[0].limit).toBeGreaterThanOrEqual(100);
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
      if (url.endsWith("/keyword_ideas/live")) return Response.json(payload({ items: [{
        keyword: "online graphic design",
        keyword_info: { search_volume: 1_300, cpc: 6 },
        keyword_properties: { keyword_difficulty: 29 },
        search_intent_info: { main_intent: "commercial" },
      }] }));
      if (url.endsWith("/keyword_suggestions/live")) return Response.json(payload({ items: [] }));
      if (url.endsWith("/search_intent/live")) return Response.json(payload({ items: [] }));
      if (url.endsWith("/historical_rank_overview/live")) return Response.json(payload({ items: [] }));
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
      providerIntent: "commercial",
      searchIntent: "consideration",
    });
    expect(result.keywords.some((keyword) => keyword.keyword === "chevrons")).toBe(false);
    expect(result.keywords.some((keyword) => keyword.keyword === "map of globe")).toBe(false);
    expect(result.keywords.every((keyword) => typeof keyword.priorityScore === "number")).toBe(true);
  });
});
