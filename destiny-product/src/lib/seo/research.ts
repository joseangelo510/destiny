import { normalizeWebsite } from "./url";

type JsonRecord = Record<string, unknown>;

export type SearchIntent = "informational" | "commercial" | "transactional" | "navigational" | "unknown";

export type KeywordPageType = "homepage" | "blog_post" | "service_page" | "product_page" | "category_page" | "video" | "tool_or_app" | "other";

export type KeywordSerpSnapshot = {
  keyword: string;
  location: string;
  checkedAt: string;
  organic: Array<{ position: number; domain: string; title: string; url: string; pageType: KeywordPageType }>;
  questions: string[];
  related: string[];
};

export type KeywordResearchRow = {
  keyword: string;
  intent: SearchIntent;
  volume: number;
  difficulty: number;
  cpc: number;
  competition: number;
  trend: number[];
  position: number;
  traffic: number;
  url: string;
};

export type KeywordResearchResult = {
  sourceLabel: string;
  query: string;
  mode: "keyword" | "domain";
  location: string;
  updatedAt: string;
  metrics: ReturnType<typeof summarizeKeywordResearch>;
  performance?: Array<{
    date: string;
    traffic: number;
    keywords: number;
    top3: number;
    top10: number;
  }>;
  questions?: string[];
  related?: string[];
  serpCheckedAt?: string;
  serpEvidenceStatus?: "live" | "unavailable";
  rows: KeywordResearchRow[];
  notices: string[];
};

export type BacklinkResearchRow = {
  sourceDomain: string;
  sourceUrl: string;
  targetUrl: string;
  anchor: string;
  domainRank: number;
  pageRank: number;
  dofollow: boolean;
  firstSeen: string;
  lastSeen: string;
  type: string;
  status: "live" | "lost";
};

export type BacklinkResearchResult = {
  sourceLabel: string;
  target: string;
  updatedAt: string;
  totalRows: number;
  summary: {
    domainRank: number;
    backlinks: number;
    referringDomains: number;
    referringPages: number;
    referringIps: number;
    brokenBacklinks: number;
    spamScore: number;
  };
  rows: BacklinkResearchRow[];
  linkTypes: Array<{ label: string; value: number }>;
  attributes: Array<{ label: string; value: number }>;
  authorityBuckets: Array<{ label: string; value: number }>;
  topDomains: Array<{ label: string; value: number }>;
  topAnchors: Array<{ label: string; value: number }>;
  notices: string[];
};

export type ReoptimizationResearchResult = {
  sourceLabel: string;
  keyword: string;
  pageUrl: string;
  location: string;
  updatedAt: string;
  providerCost: number;
  serp: {
    organic: Array<{ rank: number; title: string; url: string; domain: string; description: string }>;
    peopleAlsoAsk: string[];
    relatedSearches: string[];
    features: string[];
  };
  currentPage: { title: string; description: string; headings: string[]; headingStructure: Array<{ level: 1 | 2 | 3 | 4 | 5 | 6; text: string }>; text: string; wordCount: number; links: Array<{ url: string; anchor: string }> };
  competitorPages: Array<{ rank: number; title: string; url: string; domain: string; headings: string[]; headingStructure: Array<{ level: 1 | 2 | 3 | 4 | 5 | 6; text: string }>; text: string; wordCount: number; backlinkRank: number; referringDomains: number }>;
  queries: {
    currentRankings: Array<{ keyword: string; intent: SearchIntent; volume: number; difficulty: number; position: number; url: string }>;
    related: Array<{ keyword: string; intent: SearchIntent; volume: number; difficulty: number }>;
  };
  onPage: { score: number; checks: string[]; loadTimeMs: number; sizeBytes: number };
  backlinks: { rank: number; backlinks: number; referringDomains: number; brokenBacklinks: number };
  notices: string[];
};

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function number(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return 0;
}

function string(value: unknown) {
  return typeof value === "string" ? value : "";
}

function firstResult(payload: unknown) {
  const root = record(payload);
  const task = record(array(root.tasks)[0]);
  if (number(root.status_code) !== 20000 || number(task.status_code) !== 20000) {
    const message = string(task.status_message) || string(root.status_message) || "Unknown API error";
    throw new Error(`DataForSEO rejected the research request: ${message}`);
  }
  return record(array(task.result)[0]);
}

function providerCost(...payloads: unknown[]) {
  return payloads.reduce<number>((total, payload) => total + array(record(payload).tasks).reduce<number>((sum, task) => sum + number(record(task).cost), 0), 0);
}

function domain(value: string) {
  try { return new URL(value).hostname.replace(/^www\./, ""); } catch { return ""; }
}

function stringsByKey(value: unknown, accepted: Set<string>, output: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) stringsByKey(item, accepted, output);
    return output;
  }
  const row = record(value);
  for (const [key, item] of Object.entries(row)) {
    if (accepted.has(key) && typeof item === "string" && item.trim()) output.push(tidyResearchText(item));
    if (item && typeof item === "object") stringsByKey(item, accepted, output);
  }
  return output;
}

function tidyResearchText(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function parsedContent(payload: unknown) {
  const result = firstResult(payload);
  const item = record(array(result.items)[0]);
  const meta = record(item.meta);
  const markdown = string(item.page_as_markdown) || string(record(item.page_content).page_as_markdown);
  const textParts = stringsByKey(item.page_content, new Set(["text"]));
  const text = tidyResearchText(markdown || textParts.join(" ")).slice(0, 30_000);
  const headingStructure = markdown
    ? markdown.split("\n").flatMap((line) => {
      const match = /^(#{1,6})\s+(.+)$/.exec(line.trim());
      const text = match?.[2]?.trim();
      return match && text ? [{ level: match[1].length as 1 | 2 | 3 | 4 | 5 | 6, text }] : [];
    })
    : [];
  const headings = headingStructure.length
    ? headingStructure.map((heading) => heading.text)
    : stringsByKey(item.page_content, new Set(["h1", "h2", "h3", "heading"]));
  const links: Array<{ url: string; anchor: string }> = [];
  const collectLinks = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(collectLinks);
    const row = record(value);
    const url = string(row.url);
    const anchor = string(row.anchor_text);
    if (/^https?:\/\//i.test(url)) links.push({ url, anchor: tidyResearchText(anchor) });
    Object.values(row).forEach((item) => { if (item && typeof item === "object") collectLinks(item); });
  };
  collectLinks(item.page_content);
  return {
    title: string(meta.title) || string(item.title) || stringsByKey(item.page_content, new Set(["h_title"]))[0] || "",
    description: string(meta.description),
    headings: [...new Set(headings.filter(Boolean))].slice(0, 80),
    headingStructure: headingStructure.filter((heading, index) => headingStructure.findIndex((candidate) => candidate.level === heading.level && candidate.text === heading.text) === index).slice(0, 80),
    text,
    wordCount: text.split(/\s+/).filter(Boolean).length,
    links: links.filter((link, index) => links.findIndex((candidate) => candidate.url === link.url && candidate.anchor === link.anchor) === index).slice(0, 200),
  };
}

export function parseReoptimizationResearch(input: {
  keyword: string;
  pageUrl: string;
  location: string;
  serpPayload: unknown;
  currentPayload: unknown;
  instantPayload: unknown;
  backlinksPayload: unknown;
  currentRankingsPayload?: unknown;
  relatedKeywordsPayload?: unknown;
  competitorPayloads: unknown[];
  competitorBacklinkPayloads?: unknown[];
}): ReoptimizationResearchResult {
  const targetDomain = domain(input.pageUrl);
  const serpResult = firstResult(input.serpPayload);
  const serpItems = array(serpResult.items).map(record);
  const organic = serpItems.flatMap((item) => item.type === "organic" && /^https?:\/\//i.test(string(item.url)) ? [{
    rank: number(item.rank_group) || number(item.rank_absolute), title: string(item.title), url: string(item.url), domain: domain(string(item.url)), description: string(item.description),
  }] : []).slice(0, 10);
  const peopleAlsoAsk = [...new Set(serpItems.filter((item) => item.type === "people_also_ask").flatMap((item) => stringsByKey(item, new Set(["title", "question"])) ))].slice(0, 12);
  const relatedSearches = [...new Set(serpItems.filter((item) => item.type === "related_searches").flatMap((item) => stringsByKey(item, new Set(["title", "keyword"])) ))].slice(0, 12);
  const features = [...new Set(serpItems.map((item) => string(item.type)).filter((type) => type && type !== "organic"))];
  const currentPage = parsedContent(input.currentPayload);
  const competitorRows = organic.filter((item) => item.domain && item.domain !== targetDomain).slice(0, input.competitorPayloads.length);
  const competitorPages = input.competitorPayloads.flatMap((payload, index) => {
    try {
      const content = parsedContent(payload);
      const serp = competitorRows[index];
      const authority = input.competitorBacklinkPayloads?.[index] ? firstResult(input.competitorBacklinkPayloads[index]) : {};
      return serp ? [{ ...content, rank: serp.rank, title: content.title || serp.title, url: serp.url, domain: serp.domain, backlinkRank: number(authority.rank), referringDomains: number(authority.referring_domains) }] : [];
    } catch { return []; }
  });
  const instant = record(array(firstResult(input.instantPayload).items)[0]);
  const backlinks = firstResult(input.backlinksPayload);
  const currentRankings = input.currentRankingsPayload ? parseKeywordResearch(input.currentRankingsPayload).map((row) => ({ keyword: row.keyword, intent: row.intent, volume: row.volume, difficulty: row.difficulty, position: row.position, url: row.url })) : [];
  const related = input.relatedKeywordsPayload ? parseKeywordResearch(input.relatedKeywordsPayload).map((row) => ({ keyword: row.keyword, intent: row.intent, volume: row.volume, difficulty: row.difficulty })) : [];
  return {
    sourceLabel: "Live DataForSEO re-optimization evidence",
    keyword: input.keyword,
    pageUrl: input.pageUrl,
    location: input.location,
    updatedAt: new Date().toISOString(),
    providerCost: providerCost(input.serpPayload, input.currentPayload, input.instantPayload, input.backlinksPayload, input.currentRankingsPayload, input.relatedKeywordsPayload, ...input.competitorPayloads, ...(input.competitorBacklinkPayloads ?? [])),
    serp: { organic, peopleAlsoAsk, relatedSearches, features },
    currentPage,
    competitorPages,
    queries: { currentRankings, related },
    onPage: {
      score: number(instant.onpage_score),
      checks: Object.entries(record(instant.checks)).flatMap(([check, active]) => active === true ? [check] : []),
      loadTimeMs: number(record(instant.page_timing).duration_time),
      sizeBytes: number(instant.size),
    },
    backlinks: { rank: number(backlinks.rank), backlinks: number(backlinks.backlinks), referringDomains: number(backlinks.referring_domains), brokenBacklinks: number(backlinks.broken_backlinks) },
    notices: [
      "Rankings, volumes, backlink counts, and competitor pages are third-party DataForSEO observations.",
      "Recommendations must preserve the current URL and material that already earns rankings or links unless consolidation is explicitly justified.",
    ],
  };
}

function intent(value: unknown): SearchIntent {
  const normalized = string(value).toLowerCase();
  return normalized === "informational" || normalized === "commercial" || normalized === "transactional" || normalized === "navigational"
    ? normalized
    : "unknown";
}

function monthlyTrend(keywordInfo: JsonRecord) {
  return array(keywordInfo.monthly_searches)
    .map(record)
    .sort((left, right) => number(left.year) * 12 + number(left.month) - (number(right.year) * 12 + number(right.month)))
    .slice(-12)
    .map((item) => number(item.search_volume));
}

export function parseKeywordResearch(payload: unknown): KeywordResearchRow[] {
  const result = firstResult(payload);
  return array(result.items).map((item) => {
    const row = record(item);
    const keywordData = Object.keys(record(row.keyword_data)).length ? record(row.keyword_data) : row;
    const keywordInfo = record(keywordData.keyword_info);
    const keywordProperties = record(keywordData.keyword_properties);
    const searchIntent = record(keywordData.search_intent_info);
    const rankedElement = record(row.ranked_serp_element);
    const serpItem = record(rankedElement.serp_item);
    return {
      keyword: string(keywordData.keyword),
      intent: intent(searchIntent.main_intent ?? keywordProperties.main_intent),
      volume: number(keywordInfo.search_volume),
      difficulty: number(keywordProperties.keyword_difficulty ?? keywordData.keyword_difficulty),
      cpc: number(keywordInfo.cpc),
      competition: number(keywordInfo.competition),
      trend: monthlyTrend(keywordInfo),
      position: number(serpItem.rank_group) || number(serpItem.rank_absolute),
      traffic: number(serpItem.etv),
      url: string(serpItem.url),
    };
  }).filter((row) => row.keyword);
}

export function summarizeKeywordResearch(rows: KeywordResearchRow[], providerTotal?: number) {
  return {
    totalKeywords: providerTotal || rows.length,
    totalVolume: rows.reduce((total, row) => total + row.volume, 0),
    averageDifficulty: rows.length ? Math.round(rows.reduce((total, row) => total + row.difficulty, 0) / rows.length) : 0,
    estimatedTraffic: Math.round(rows.reduce((total, row) => total + row.traffic, 0)),
  };
}

function mappedCounts(value: unknown, labelMap: Record<string, string>) {
  const counts = record(value);
  return Object.entries(counts)
    .map(([key, count]) => ({ label: labelMap[key] ?? key.replaceAll("_", " "), value: number(count) }))
    .filter((item) => item.value > 0)
    .sort((left, right) => right.value - left.value);
}

function topCounts(values: string[], limit = 6) {
  const counts = new Map<string, number>();
  for (const value of values) {
    const clean = value.trim();
    if (clean) counts.set(clean, (counts.get(clean) ?? 0) + 1);
  }
  return [...counts].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, limit);
}

export function parseBacklinkResearch(summaryPayload: unknown, linksPayload: unknown, target: string): BacklinkResearchResult {
  const summary = firstResult(summaryPayload);
  const links = firstResult(linksPayload);
  const rows: BacklinkResearchRow[] = array(links.items).map((item): BacklinkResearchRow => {
    const row = record(item);
    return {
      sourceDomain: string(row.domain_from),
      sourceUrl: string(row.url_from),
      targetUrl: string(row.url_to),
      anchor: string(row.anchor) || "No anchor text",
      domainRank: number(row.domain_from_rank),
      pageRank: number(row.page_from_rank),
      dofollow: row.dofollow === true,
      firstSeen: string(row.first_seen),
      lastSeen: string(row.last_seen),
      type: string(row.type) || "anchor",
      status: string(row.lost_date) ? "lost" : "live",
    };
  }).filter((row) => row.sourceUrl || row.sourceDomain);

  const authorityBuckets = [
    { label: "High authority", value: rows.filter((row) => row.domainRank >= 501).length },
    { label: "Established", value: rows.filter((row) => row.domainRank >= 201 && row.domainRank < 501).length },
    { label: "Emerging", value: rows.filter((row) => row.domainRank < 201).length },
  ];

  return {
    sourceLabel: "Live DataForSEO backlinks index",
    target,
    updatedAt: new Date().toISOString(),
    totalRows: number(links.total_count) || rows.length,
    summary: {
      domainRank: number(summary.rank),
      backlinks: number(summary.backlinks),
      referringDomains: number(summary.referring_domains),
      referringPages: number(summary.referring_pages),
      referringIps: number(summary.referring_ips),
      brokenBacklinks: number(summary.broken_backlinks),
      spamScore: number(summary.spam_score),
    },
    rows,
    linkTypes: mappedCounts(summary.referring_links_types, { anchor: "Text", image: "Image", redirect: "Redirect", canonical: "Canonical" }),
    attributes: mappedCounts(summary.referring_links_attributes, { dofollow: "Follow", nofollow: "Nofollow", sponsored: "Sponsored", ugc: "UGC" }),
    authorityBuckets,
    topDomains: topCounts(rows.map((row) => row.sourceDomain)),
    topAnchors: topCounts(rows.map((row) => row.anchor)),
    notices: [
      "Backlink totals and ranks are third-party estimates from the DataForSEO index.",
      "Referring domains count unique linking websites; backlinks count individual links.",
    ],
  };
}

export class DataForSeoResearchClient {
  constructor(private readonly login: string, private readonly password: string) {}

  private async post(path: string, body: JsonRecord[]) {
    const response = await fetch(`https://api.dataforseo.com${path}`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.login}:${this.password}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(45_000),
    });
    if (!response.ok) throw new Error(`DataForSEO returned HTTP ${response.status}.`);
    return response.json() as Promise<unknown>;
  }

  async keywordResearch(input: { query: string; mode: "keyword" | "domain"; locationName?: string; related?: boolean; offset?: number }): Promise<KeywordResearchResult> {
    const location = input.locationName?.trim() || "United States";
    const query = input.mode === "domain" ? normalizeWebsite(input.query).domain : input.query.trim();
    if (query.length < 2 || query.length > 200) throw new Error("Enter a keyword or public domain between 2 and 200 characters.");
    const path = input.mode === "domain"
      ? "/v3/dataforseo_labs/google/ranked_keywords/live"
      : input.related ? "/v3/dataforseo_labs/google/related_keywords/live" : "/v3/dataforseo_labs/google/keyword_suggestions/live";
    const request = input.mode === "domain"
      ? { target: query, location_name: location, language_name: "English", item_types: ["organic"], order_by: ["keyword_data.keyword_info.search_volume,desc"], limit: 100 }
      : input.related ? { keyword: query, location_name: location, language_name: "English", depth: 2, include_seed_keyword: true, offset: input.offset ?? 0, limit: 100, filters: ["keyword_data.keyword_info.search_volume", ">", 0], order_by: ["keyword_data.keyword_info.search_volume,desc"] }
      : { keyword: query, offset: input.offset ?? 0, location_name: location, language_name: "English", filters: ["keyword_info.search_volume", ">", 0], order_by: ["keyword_info.search_volume,desc"], limit: 100 };
    const payload = await this.post(path, [request]);
    const result = firstResult(payload);
    const rows = parseKeywordResearch(payload);
    return {
      sourceLabel: "Live DataForSEO keyword index",
      query,
      mode: input.mode,
      location,
      updatedAt: new Date().toISOString(),
      metrics: summarizeKeywordResearch(rows, number(result.total_count)),
      rows,
      notices: [
        "Search volume, difficulty, CPC, and traffic are third-party estimates and may differ from first-party Google data.",
        input.mode === "domain" ? "Positions show the domain's current organic rankings." : "Intent reflects the most likely purpose behind each search.",
      ],
    };
  }

  async backlinkResearch(input: { target: string }): Promise<BacklinkResearchResult> {
    const target = normalizeWebsite(input.target).domain;
    const [summaryPayload, linksPayload] = await Promise.all([
      this.post("/v3/backlinks/summary/live", [{ target, include_subdomains: true, backlinks_status_type: "all", internal_list_limit: 10 }]),
      this.post("/v3/backlinks/backlinks/live", [{ target, include_subdomains: true, backlinks_status_type: "all", order_by: ["domain_from_rank,desc", "rank,desc"], limit: 100 }]),
    ]);
    return parseBacklinkResearch(summaryPayload, linksPayload, target);
  }

  async reoptimizationResearch(input: { keyword: string; pageUrl: string; locationName?: string }): Promise<ReoptimizationResearchResult> {
    const keyword = input.keyword.trim().slice(0, 200);
    const pageUrl = normalizeWebsite(input.pageUrl).url;
    const location = input.locationName?.trim() || "United States";
    if (keyword.length < 2) throw new Error("Choose a valid focus keyword before re-optimizing.");
    const [serpPayload, currentPayload, instantPayload, backlinksPayload, currentRankingsPayload, relatedKeywordsPayload] = await Promise.all([
      this.post("/v3/serp/google/organic/live/advanced", [{ keyword, location_name: location, language_code: "en", depth: 20 }]),
      this.post("/v3/on_page/content_parsing/live", [{ url: pageUrl, markdown_view: true, enable_javascript: true }]),
      this.post("/v3/on_page/instant_pages", [{ url: pageUrl, enable_javascript: true, enable_xhr: true }]),
      this.post("/v3/backlinks/summary/live", [{ target: pageUrl, include_subdomains: false, backlinks_status_type: "all", internal_list_limit: 10 }]),
      this.post("/v3/dataforseo_labs/google/ranked_keywords/live", [{ target: pageUrl, location_name: location, language_name: "English", item_types: ["organic"], order_by: ["keyword_data.keyword_info.search_volume,desc"], limit: 100 }]),
      this.post("/v3/dataforseo_labs/google/related_keywords/live", [{ keyword, location_name: location, language_name: "English", depth: 2, include_seed_keyword: true, filters: ["keyword_data.keyword_info.search_volume", ">", 0], order_by: ["keyword_data.keyword_info.search_volume,desc"], limit: 50 }]),
    ]);
    const targetDomain = domain(pageUrl);
    const organic = array(firstResult(serpPayload).items).map(record).flatMap((item) => item.type === "organic" && /^https?:\/\//i.test(string(item.url)) && domain(string(item.url)) !== targetDomain ? [string(item.url)] : []).slice(0, 3);
    const competitorResearch = await Promise.all(organic.map(async (url) => {
      const [content, authority] = await Promise.all([
        this.post("/v3/on_page/content_parsing/live", [{ url, markdown_view: true, enable_javascript: true }]).catch(() => null),
        this.post("/v3/backlinks/summary/live", [{ target: url, include_subdomains: false, backlinks_status_type: "all", internal_list_limit: 10 }]).catch(() => null),
      ]);
      return { content, authority };
    }));
    return parseReoptimizationResearch({
      keyword, pageUrl, location, serpPayload, currentPayload, instantPayload, backlinksPayload, currentRankingsPayload, relatedKeywordsPayload,
      competitorPayloads: competitorResearch.map((item) => item.content),
      competitorBacklinkPayloads: competitorResearch.map((item) => item.authority),
    });
  }
}

export function getResearchClient() {
  const login = process.env.DATAFORSEO_LOGIN?.trim();
  const password = process.env.DATAFORSEO_PASSWORD?.trim();
  if (!login || !password) throw new Error("Live SEO research is not configured yet.");
  return new DataForSeoResearchClient(login, password);
}
