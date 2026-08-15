type JsonRecord = Record<string, unknown>;

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

export function firstResult(payload: unknown) {
  const root = record(payload);
  const task = record(array(root.tasks)[0]);
  if (number(root.status_code) !== 20000 || number(task.status_code) !== 20000) {
    throw new Error(string(task.status_message) || string(root.status_message) || "DataForSEO rejected the research request.");
  }
  return record(array(task.result)[0]);
}

function normalizeIntent(value: unknown) {
  const normalized = string(value).toLowerCase();
  return ["informational", "commercial", "transactional", "navigational"].includes(normalized) ? normalized : "unknown";
}

function monthlyTrend(keywordInfo: JsonRecord) {
  return array(keywordInfo.monthly_searches).map(record)
    .sort((left, right) => number(left.year) * 12 + number(left.month) - (number(right.year) * 12 + number(right.month)))
    .slice(-12).map((item) => number(item.search_volume));
}

export function parseKeywordRows(payload: unknown) {
  return array(firstResult(payload).items).map((item) => {
    const row = record(item);
    const keywordData = Object.keys(record(row.keyword_data)).length ? record(row.keyword_data) : row;
    const keywordInfo = record(keywordData.keyword_info);
    const keywordProperties = record(keywordData.keyword_properties);
    const searchIntent = record(keywordData.search_intent_info);
    const serpItem = record(record(row.ranked_serp_element).serp_item);
    return {
      keyword: string(keywordData.keyword),
      intent: normalizeIntent(searchIntent.main_intent ?? keywordProperties.main_intent),
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

export function summarizeKeywordRows(rows: ReturnType<typeof parseKeywordRows>, providerTotal = 0) {
  return {
    totalKeywords: providerTotal || rows.length,
    totalVolume: rows.reduce((total, row) => total + row.volume, 0),
    averageDifficulty: rows.length ? Math.round(rows.reduce((total, row) => total + row.difficulty, 0) / rows.length) : 0,
    estimatedTraffic: Math.round(rows.reduce((total, row) => total + row.traffic, 0)),
  };
}

export function parseOrganicPerformance(payload: unknown) {
  return array(firstResult(payload).items).map((item) => {
    const row = record(item);
    const organic = record(record(row.metrics).organic);
    const year = number(row.year);
    const month = number(row.month);
    return {
      date: `${year}-${String(month).padStart(2, "0")}-01`,
      traffic: Math.round(number(organic.etv)),
      keywords: number(organic.count),
      top3: number(organic.pos_1) + number(organic.pos_2_3),
      top10: number(organic.pos_1) + number(organic.pos_2_3) + number(organic.pos_4_10),
    };
  }).filter((point) => /^\d{4}-\d{2}-01$/.test(point.date))
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(-3);
}

export function organicHistoryWindowStart(now = new Date()) {
  const start = new Date(now);
  start.setUTCDate(1);
  start.setUTCMonth(start.getUTCMonth() - 3);
  return start.toISOString().slice(0, 10);
}

function mappedCounts(value: unknown, labels: Record<string, string>) {
  return Object.entries(record(value)).map(([key, count]) => ({ label: labels[key] ?? key.replaceAll("_", " "), value: number(count) }))
    .filter((item) => item.value > 0).sort((left, right) => right.value - left.value);
}

function topCounts(values: string[], limit = 6) {
  const counts = new Map<string, number>();
  for (const value of values) if (value.trim()) counts.set(value.trim(), (counts.get(value.trim()) ?? 0) + 1);
  return [...counts].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, limit);
}

export function parseBacklinks(summaryPayload: unknown, linksPayload: unknown, target: string) {
  const summary = firstResult(summaryPayload);
  const links = firstResult(linksPayload);
  const rows = array(links.items).map((item) => {
    const row = record(item);
    return {
      sourceDomain: string(row.domain_from), sourceUrl: string(row.url_from), targetUrl: string(row.url_to),
      anchor: string(row.anchor) || "No anchor text", domainRank: number(row.domain_from_rank), pageRank: number(row.page_from_rank),
      dofollow: row.dofollow === true, firstSeen: string(row.first_seen), lastSeen: string(row.last_seen),
      type: string(row.type) || "anchor", status: string(row.lost_date) ? "lost" as const : "live" as const,
    };
  }).filter((row) => row.sourceUrl || row.sourceDomain);
  return {
    sourceLabel: "Live DataForSEO backlinks index", target, updatedAt: new Date().toISOString(),
    totalRows: number(links.total_count) || rows.length,
    summary: {
      domainRank: number(summary.rank), backlinks: number(summary.backlinks), referringDomains: number(summary.referring_domains),
      referringPages: number(summary.referring_pages), referringIps: number(summary.referring_ips),
      brokenBacklinks: number(summary.broken_backlinks), spamScore: number(summary.spam_score),
    },
    rows,
    linkTypes: mappedCounts(summary.referring_links_types, { anchor: "Text", image: "Image", redirect: "Redirect", canonical: "Canonical" }),
    attributes: mappedCounts(summary.referring_links_attributes, { dofollow: "Follow", nofollow: "Nofollow", sponsored: "Sponsored", ugc: "UGC" }),
    authorityBuckets: [
      { label: "High authority", value: rows.filter((row) => row.domainRank >= 501).length },
      { label: "Established", value: rows.filter((row) => row.domainRank >= 201 && row.domainRank < 501).length },
      { label: "Emerging", value: rows.filter((row) => row.domainRank < 201).length },
    ],
    topDomains: topCounts(rows.map((row) => row.sourceDomain)), topAnchors: topCounts(rows.map((row) => row.anchor)),
    notices: [
      "Backlink totals and ranks are third-party estimates from the DataForSEO index.",
      "Referring domains count unique linking websites; backlinks count individual links.",
    ],
  };
}

export function normalizeDomain(value: string) {
  const withProtocol = /^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`;
  const url = new URL(withProtocol);
  const domain = url.hostname.toLowerCase().replace(/^www\./, "");
  if (!domain || !domain.includes(".") || domain === "localhost") throw new Error("Enter a valid public domain.");
  return domain;
}

const CREATOR_PLATFORMS = ["medium.com", "youtube.com", "linkedin.com", "instagram.com"] as const;
const INELIGIBLE_CREATOR_HOSTS = [
  "wikipedia.org", "wikimedia.org", "britannica.com", "fandom.com", "imdb.com",
  "amazon.com", "amazon.co.uk", "amazon.ca", "amazon.de", "amazon.fr", "amazon.es", "amazon.it", "amazon.in", "amazon.co.jp", "amazon.com.au", "amazon.com.br", "amazon.com.mx",
  "forbes.com", "yahoo.com", "yahoo.co.uk", "yahoo.co.jp", "nytimes.com", "foxnews.com", "cnn.com", "bbc.com", "bbc.co.uk", "wsj.com", "washingtonpost.com", "businessinsider.com", "bloomberg.com", "reuters.com", "apnews.com", "cnbc.com", "theguardian.com", "usatoday.com",
  "google.com", "bing.com", "microsoft.com", "apple.com", "walmart.com", "ebay.com", "etsy.com",
  "yelp.com", "bbb.org", "tripadvisor.com", "zillow.com", "realtor.com", "yellowpages.com",
  "reddit.com", "quora.com", "stackoverflow.com",
] as const;

function isIneligibleCreatorDomain(domain: string): boolean {
  return INELIGIBLE_CREATOR_HOSTS.some((host) => domain === host || domain.endsWith(`.${host}`));
}

export function creatorSearchRequests(topics: string[], locationName = "United States") {
  const topic = topics.map((item) => item.trim()).find((item) => item.length >= 2)?.slice(0, 160) ?? "";
  if (!topic) return [];
  return [
    ...CREATOR_PLATFORMS.map((domain) => ({ keyword: `${topic} site:${domain}`, location_name: locationName, language_code: "en", depth: 20 })),
    { keyword: `${topic} independent blog`, location_name: locationName, language_code: "en", depth: 20 },
  ];
}

export function parseCreatorSearchResults(payload: unknown, excludedDomains: string[] = []) {
  const root = record(payload);
  if (number(root.status_code) !== 20000) throw new Error(string(root.status_message) || "DataForSEO rejected creator research.");
  const excluded = new Set(excludedDomains.map((domain) => domain.toLowerCase().replace(/^www\./, "")));
  const seen = new Set<string>();
  return array(root.tasks).flatMap((taskValue) => {
    const task = record(taskValue);
    if (number(task.status_code) !== 20000) return [];
    const query = string(record(task.data).keyword);
    const topic = query.replace(/\s+site:[^\s]+$/i, "").replace(/\s+independent blog$/i, "").trim();
    return array(record(array(task.result)[0]).items).flatMap((itemValue) => {
      const item = record(itemValue);
      if (string(item.type) !== "organic") return [];
      const url = string(item.url);
      let domain = "";
      try { domain = new URL(url).hostname.toLowerCase().replace(/^www\./, ""); } catch { return []; }
      if (!domain || excluded.has(domain) || [...excluded].some((value) => domain.endsWith(`.${value}`)) || isIneligibleCreatorDomain(domain) || seen.has(url)) return [];
      seen.add(url);
      const platform = domain.includes("medium.com") ? "Medium"
        : domain.includes("youtube.com") ? "YouTube"
          : domain.includes("linkedin.com") ? "LinkedIn"
            : domain.includes("instagram.com") ? "Instagram"
              : "Independent blog";
      return [{
        name: string(item.title).split(/[—|]/)[0].trim() || domain,
        domain,
        platform,
        title: string(item.title) || "Relevant published work",
        url,
        snippet: string(item.description),
        matchedTopic: topic,
        audienceEstimate: null,
        audienceVerification: "required" as const,
      }];
    });
  }).slice(0, 25);
}

export function parseArticleEvidence(payload: unknown, limit = 5) {
  const result = firstResult(payload);
  const seen = new Set<string>();
  return array(result.items).flatMap((itemValue) => {
    const item = record(itemValue);
    if (string(item.type) !== "organic") return [];
    const title = string(item.title).trim();
    const url = string(item.url).trim();
    if (!title || !/^https:\/\//i.test(url) || seen.has(url)) return [];
    let publisher = "";
    try { publisher = new URL(url).hostname.toLowerCase().replace(/^www\./, ""); } catch { return []; }
    seen.add(url);
    return [{ title, url, publisher, description: string(item.description).trim() }];
  }).slice(0, Math.max(1, limit));
}
