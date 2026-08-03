import { normalizeWebsite } from "./url";

type JsonRecord = Record<string, unknown>;

export type SearchIntent = "informational" | "commercial" | "transactional" | "navigational" | "unknown";

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

  async keywordResearch(input: { query: string; mode: "keyword" | "domain"; locationName?: string }): Promise<KeywordResearchResult> {
    const location = input.locationName?.trim() || "United States";
    const query = input.mode === "domain" ? normalizeWebsite(input.query).domain : input.query.trim();
    if (query.length < 2 || query.length > 200) throw new Error("Enter a keyword or public domain between 2 and 200 characters.");
    const path = input.mode === "domain"
      ? "/v3/dataforseo_labs/google/ranked_keywords/live"
      : "/v3/dataforseo_labs/google/keyword_suggestions/live";
    const request = input.mode === "domain"
      ? { target: query, location_name: location, language_name: "English", item_types: ["organic"], order_by: ["keyword_data.keyword_info.search_volume,desc"], limit: 100 }
      : { keyword: query, location_name: location, language_name: "English", filters: ["keyword_info.search_volume", ">", 0], order_by: ["keyword_info.search_volume,desc"], limit: 100 };
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
}

export function getResearchClient() {
  const login = process.env.DATAFORSEO_LOGIN?.trim();
  const password = process.env.DATAFORSEO_PASSWORD?.trim();
  if (!login || !password) throw new Error("Live SEO research is not configured yet.");
  return new DataForSeoResearchClient(login, password);
}
