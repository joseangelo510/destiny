import type {
  SeoAuditRequest,
  SeoAuditResult,
  SeoCompetitor,
  SeoIssue,
  SeoKeyword,
  SeoProvider,
} from "./types";
import { normalizeWebsite } from "./url";

type JsonRecord = Record<string, unknown>;

const CRITICAL_CHECKS = new Set([
  "canonical_to_broken",
  "has_redirect",
  "is_4xx_code",
  "is_5xx_code",
  "is_broken",
  "no_content",
  "no_description",
  "no_h1_tag",
  "no_title",
]);

const CHECK_LABELS: Record<string, string> = {
  canonical_to_broken: "Canonical URL points to a broken page",
  canonical_to_redirect: "Canonical URL points to a redirect",
  deprecated_html_tags: "Page uses deprecated HTML tags",
  duplicate_meta_tags: "Page contains duplicate meta tags",
  duplicate_title_tag: "Page contains more than one title tag",
  has_meta_refresh_redirect: "Page uses a meta refresh redirect",
  has_micromarkup_errors: "Structured data contains errors",
  has_render_blocking_resources: "Page has render-blocking resources",
  has_redirect: "Page redirects before loading",
  high_loading_time: "Page takes more than three seconds to load",
  high_waiting_time: "Server response time is too slow",
  irrelevant_description: "Meta description does not match the page content",
  irrelevant_title: "Page title does not match the page content",
  is_4xx_code: "Page returns a 4xx response",
  is_5xx_code: "Page returns a 5xx response",
  is_broken: "Page is broken",
  is_http: "Page is not using HTTPS",
  large_page_size: "Page HTML is larger than one megabyte",
  low_character_count: "Page has too little readable text",
  low_content_rate: "Page has a low text-to-HTML ratio",
  low_readability_rate: "Page content is difficult to read",
  no_content: "Page has no readable content",
  no_content_encoding: "Page content is not compressed",
  no_description: "Meta description is missing",
  no_doctype: "HTML doctype is missing",
  no_h1_tag: "H1 heading is missing",
  no_image_alt: "Images are missing alt text",
  no_image_title: "Images are missing title attributes",
  no_title: "Page title is missing",
  small_page_size: "Page contains very little HTML content",
  title_too_long: "Page title is too long",
  title_too_short: "Page title is too short",
};

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function string(value: unknown) {
  return typeof value === "string" ? value : "";
}

function firstResult(payload: unknown) {
  const root = record(payload);
  const task = record(array(root.tasks)[0]);
  if (number(root.status_code) !== 20000 || number(task.status_code) !== 20000) {
    const message = string(task.status_message) || string(root.status_message) || "Unknown API error";
    throw new Error(`DataForSEO rejected the audit: ${message}`);
  }
  return record(array(task.result)[0]);
}

function pageIssues(page: JsonRecord) {
  const checks = record(page.checks);
  const issues: SeoIssue[] = Object.entries(checks)
    .filter(([code, active]) => active === true && code in CHECK_LABELS)
    .map(([code]) => ({
      code,
      label: CHECK_LABELS[code] ?? code.replaceAll("_", " "),
      severity: CRITICAL_CHECKS.has(code) ? "critical" as const : "warning" as const,
    }));

  if (page.broken_links === true && !issues.some((issue) => issue.code === "broken_links")) {
    issues.unshift({ code: "broken_links", label: "Page contains broken links", severity: "critical" });
  }
  return issues;
}

function parseCompetitors(result: JsonRecord, targetDomain: string): SeoCompetitor[] {
  return array(result.items).slice(0, 5).map((item) => {
    const competitor = record(item);
    return {
      domain: string(competitor.domain),
      sharedKeywords: number(competitor.intersections),
    };
  }).filter((competitor) => competitor.domain && competitor.domain.toLowerCase().replace(/^www\./, "") !== targetDomain);
}

function parseRankedKeywords(result: JsonRecord): SeoKeyword[] {
  return array(result.items).slice(0, 25).map((item) => {
    const row = record(item);
    const keywordData = record(row.keyword_data);
    const keywordInfo = record(keywordData.keyword_info);
    const keywordProperties = record(keywordData.keyword_properties);
    const rankedElement = record(row.ranked_serp_element);
    const serpItem = record(rankedElement.serp_item);
    return {
      keyword: string(keywordData.keyword),
      rank: number(serpItem.rank_group) || number(serpItem.rank_absolute),
      searchVolume: number(keywordInfo.search_volume),
      url: string(serpItem.url),
      intent: string(keywordProperties.main_intent),
      difficulty: number(keywordProperties.keyword_difficulty) || number(keywordData.keyword_difficulty),
      cpc: number(keywordInfo.cpc),
      opportunity: "existing_rank" as const,
    };
  }).filter((keyword) => keyword.keyword);
}

function parseKeywordIdeas(result: JsonRecord): SeoKeyword[] {
  return array(result.items).slice(0, 25).map((item) => {
    const row = record(item);
    const keywordInfo = record(row.keyword_info);
    const keywordProperties = record(row.keyword_properties);
    const searchIntent = record(row.search_intent_info);
    return {
      keyword: string(row.keyword),
      rank: 0,
      searchVolume: number(keywordInfo.search_volume),
      url: "",
      intent: string(searchIntent.main_intent),
      difficulty: number(keywordProperties.keyword_difficulty),
      cpc: number(keywordInfo.cpc),
      opportunity: "site_idea" as const,
    };
  }).filter((keyword) => keyword.keyword);
}

function parseGapKeywords(result: JsonRecord): SeoKeyword[] {
  return array(result.items).slice(0, 25).map((item) => {
    const row = record(item);
    const keywordData = record(row.keyword_data);
    const keywordInfo = record(keywordData.keyword_info);
    const keywordProperties = record(keywordData.keyword_properties);
    const searchIntent = record(keywordData.search_intent_info);
    return {
      keyword: string(keywordData.keyword),
      rank: 0,
      searchVolume: number(keywordInfo.search_volume),
      url: "",
      intent: string(searchIntent.main_intent) || string(keywordProperties.main_intent),
      difficulty: number(keywordProperties.keyword_difficulty) || number(keywordData.keyword_difficulty),
      cpc: number(keywordInfo.cpc),
      opportunity: "competitor_gap" as const,
    };
  }).filter((keyword) => keyword.keyword);
}

function keywordIdentity(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/\bmonths\b/g, "month")
    .replace(/\boutfits\b/g, "outfit")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function looksLikeAddressKeyword(value: string) {
  const normalized = keywordIdentity(value);
  return /\b\d{5}(?:\s+\d{4})?\b/.test(normalized)
    && /\b(?:avenue|ave|boulevard|blvd|drive|dr|lane|ln|road|rd|street|st|way)\b/.test(normalized);
}

export function mergeKeywordStrategy(groups: SeoKeyword[][], limit = 24) {
  const queues = groups.map((group) => [...group]);
  const seen = new Set<string>();
  const strategy: SeoKeyword[] = [];
  while (strategy.length < limit && queues.some((queue) => queue.length)) {
    for (const queue of queues) {
      const candidate = queue.shift();
      if (!candidate) continue;
      const key = keywordIdentity(candidate.keyword);
      if (!key || looksLikeAddressKeyword(candidate.keyword) || seen.has(key)) continue;
      seen.add(key);
      strategy.push(candidate);
      if (strategy.length === limit) break;
    }
  }
  return strategy;
}

const CONTEXT_STOP_WORDS = new Set([
  "about", "across", "after", "also", "and", "are", "been", "business", "customer", "for", "from", "help", "into", "more", "people", "provide", "services", "that", "the", "their", "them", "they", "this", "through", "want", "who", "with", "you", "your",
]);

function contextTokens(input: SeoAuditRequest["businessContext"]) {
  const value = `${input?.productsServices ?? ""} ${input?.problemSolved ?? ""} ${input?.idealCustomer ?? ""} ${input?.audienceChallengesGoals ?? ""} ${input?.market ?? ""}`.toLowerCase();
  return new Set(value.split(/[^a-z0-9]+/).filter((token) => token.length >= 3 && !CONTEXT_STOP_WORDS.has(token)));
}

export function buildKeywordStrategy(groups: SeoKeyword[][], context: SeoAuditRequest["businessContext"], limit = 24) {
  const tokens = contextTokens(context);
  if (!tokens.size) return mergeKeywordStrategy(groups, limit);
  const relevantGroups = groups.map((group) => group.filter((keyword) => {
    const phrase = keyword.keyword.toLowerCase();
    return [...tokens].some((token) => phrase.includes(token));
  }));
  const strategy = mergeKeywordStrategy(relevantGroups, limit);
  const seen = new Set(strategy.map((keyword) => keywordIdentity(keyword.keyword)));
  if (strategy.length < limit) {
    const fallback = mergeKeywordStrategy(groups, groups.reduce((total, group) => total + group.length, 0));
    for (const keyword of fallback) {
      const key = keywordIdentity(keyword.keyword);
      if (seen.has(key)) continue;
      seen.add(key);
      strategy.push(keyword);
      if (strategy.length === limit) break;
    }
  }
  return strategy;
}

export class DataForSeoProvider implements SeoProvider {
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

    if (!response.ok) {
      throw new Error(`DataForSEO returned HTTP ${response.status}.`);
    }
    return response.json() as Promise<unknown>;
  }

  async runAudit(input: SeoAuditRequest): Promise<SeoAuditResult> {
    const website = normalizeWebsite(input.website);
    const locationName = input.locationName?.trim() || "United States";

    const [pagePayload, rankingsPayload, competitorsPayload, ideasPayload] = await Promise.all([
      this.post("/v3/on_page/instant_pages", [{ url: website.url, enable_javascript: true }]),
      this.post("/v3/dataforseo_labs/google/ranked_keywords/live", [{
        target: website.domain,
        location_name: locationName,
        language_name: "English",
        item_types: ["organic", "local_pack", "featured_snippet"],
        limit: 24,
      }]),
      this.post("/v3/dataforseo_labs/google/competitors_domain/live", [{
        target: website.domain,
        location_name: locationName,
        language_name: "English",
        item_types: ["organic", "local_pack"],
        exclude_top_domains: true,
        limit: 5,
      }]),
      this.post("/v3/dataforseo_labs/google/keywords_for_site/live", [{
        target: website.domain,
        location_name: locationName,
        language_name: "English",
        filters: ["keyword_info.search_volume", ">", 0],
        order_by: ["relevance,desc", "keyword_info.search_volume,desc"],
        limit: 24,
      }]),
    ]);

    const pageResult = firstResult(pagePayload);
    const page = record(array(pageResult.items)[0]);
    const rankings = firstResult(rankingsPayload);
    const organicMetrics = record(record(rankings.metrics).organic);
    const competitorResult = firstResult(competitorsPayload);
    const competitors = parseCompetitors(competitorResult, website.domain);
    const rankedKeywords = parseRankedKeywords(rankings);
    const keywordIdeas = parseKeywordIdeas(firstResult(ideasPayload));
    const issues = pageIssues(page);

    let contentGaps = 0;
    let gapKeywords: SeoKeyword[] = [];
    if (competitors[0]?.domain) {
      const gapsPayload = await this.post("/v3/dataforseo_labs/google/domain_intersection/live", [{
        target1: competitors[0].domain,
        target2: website.domain,
        location_name: locationName,
        language_name: "English",
        intersections: false,
        item_types: ["organic", "local_pack"],
        filters: ["keyword_data.keyword_info.search_volume", ">", 0],
        order_by: ["keyword_data.keyword_info.search_volume,desc"],
        limit: 24,
      }]);
      const gapResult = firstResult(gapsPayload);
      gapKeywords = parseGapKeywords(gapResult);
      contentGaps = gapKeywords.length;
    }

    return {
      source: "dataforseo",
      sourceLabel: "Live DataForSEO audit",
      domain: website.domain,
      fetchedAt: new Date().toISOString(),
      metrics: {
        criticalIssues: issues.filter((issue) => issue.severity === "critical").length,
        warnings: issues.filter((issue) => issue.severity === "warning").length,
        rankingKeywords: number(organicMetrics.count) || number(rankings.total_count),
        newKeywords: number(organicMetrics.is_new),
        lostKeywords: number(organicMetrics.is_lost),
        estimatedOrganicTraffic: number(organicMetrics.etv),
        contentGaps,
        reviewCount: 0,
        onPageScore: typeof page.onpage_score === "number" ? page.onpage_score : null,
      },
      issues: issues.slice(0, 10),
      competitors,
      keywords: buildKeywordStrategy([rankedKeywords, gapKeywords, keywordIdeas], input.businessContext),
      notices: [
        "Keyword and competitor indexes are DataForSEO estimates updated on their provider schedule.",
        "The content strategy combines current rankings, competitor gaps, and domain-relevant keyword ideas.",
        "Google review count stays at zero until Google Business Profile is connected.",
      ],
    };
  }
}
