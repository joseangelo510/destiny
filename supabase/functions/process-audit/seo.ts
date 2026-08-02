import { runDestinyLogic } from "./logic.ts";
import {
  buildKeywordFacts,
  extractSiteVocabulary,
  parseContentPage,
  parseDistributionSerp,
  parseLlmVisibility,
  selectImportantPageLinks,
  type DistributionOpportunity,
  type LlmVisibility,
  type SitePageEvidence,
  type SiteVocabularyTerm,
} from "./intelligence.ts";

export type AuditSource = "demo" | "dataforseo";

export type SeoAuditResult = {
  source: AuditSource;
  sourceLabel: string;
  domain: string;
  fetchedAt: string;
  metrics: {
    criticalIssues: number;
    warnings: number;
    rankingKeywords: number;
    newKeywords: number;
    lostKeywords: number;
    estimatedOrganicTraffic: number;
    contentGaps: number;
    reviewCount: number;
    onPageScore: number | null;
  };
  issues: Array<{ code: string; label: string; severity: "critical" | "warning" }>;
  competitors: Array<{ domain: string; sharedKeywords: number }>;
  keywords: Array<{
    keyword: string;
    rank: number;
    searchVolume: number;
    url: string;
    intent: string;
    difficulty: number;
    cpc: number;
    opportunity: "existing_rank" | "competitor_gap" | "site_idea";
    normalizedKeyword?: string;
    matchedTerms?: string[];
    competitorRankers?: number;
    verdict?: "accept" | "review" | "reject";
    ruleId?: string;
    reason?: string;
    essential?: boolean;
  }>;
  pages?: SitePageEvidence[];
  siteVocabulary?: SiteVocabularyTerm[];
  distributionOpportunities?: DistributionOpportunity[];
  llmVisibility?: LlmVisibility;
  notices: string[];
};

type JsonRecord = Record<string, unknown>;

const CRITICAL_CHECKS = new Set([
  "canonical_to_broken", "has_redirect", "is_4xx_code", "is_5xx_code",
  "is_broken", "no_content", "no_description", "no_h1_tag", "no_title",
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
function array(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function number(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? value : 0; }
function string(value: unknown) { return typeof value === "string" ? value : ""; }

export function normalizeWebsite(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 2048) throw new Error("Enter a valid public website.");
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error("Website must use http or https.");
  const domain = url.hostname.toLowerCase().replace(/^www\./, "");
  const isIpAddress = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(domain) || domain.includes(":");
  const isLocalName = domain === "localhost" || domain.endsWith(".localhost") || domain.endsWith(".local") || domain.endsWith(".internal");
  if (!domain || !domain.includes(".") || isIpAddress || isLocalName) throw new Error("Enter a valid public website.");
  url.username = "";
  url.password = "";
  url.hash = "";
  return { url: url.toString(), domain };
}

function stableNumber(value: string) {
  return [...value].reduce((total, character) => ((total * 31) + character.charCodeAt(0)) >>> 0, 2166136261);
}

type BusinessContext = { productsServices?: string; idealCustomer?: string; market?: string };

const realEstateTopics = [
  "san francisco homes for sale", "best san francisco neighborhoods for families", "first-time home buyer san francisco", "how to buy a home in san francisco",
  "san francisco home selling guide", "moving to san francisco with a family", "noe valley homes for families", "bernal heights homes for sale",
  "inner sunset homes for sale", "glen park homes for families", "san francisco school district home search", "how much house can i afford in san francisco",
  "san francisco home inspection checklist", "make a competitive home offer san francisco", "best time to sell a home in san francisco", "prepare a san francisco home for sale",
  "san francisco real estate market update", "closing costs for san francisco home buyers", "sell and buy a home at the same time", "relocating to san francisco neighborhoods",
  "family-friendly parks near san francisco homes", "walkable san francisco neighborhoods", "questions to ask a san francisco realtor", "choose a san francisco real estate agent",
];

const professionalTopics = [
  "services near me", "best local professional", "local service pricing guide", "how to choose a local provider",
  "questions to ask before hiring", "local provider reviews", "service comparison guide", "what to expect from a consultation",
  "common service mistakes to avoid", "local customer success story", "professional service checklist", "service options explained",
  "how long professional services take", "prepare for your first appointment", "local industry trends", "service costs and value",
  "when to hire a professional", "do it yourself versus hiring an expert", "local service frequently asked questions", "best solutions for growing businesses",
  "expert advice for first-time customers", "how to evaluate service quality", "local professional case study", "complete local services guide",
];

function demoKeywords(context: BusinessContext | undefined, domain: string, url: string, seed: number): SeoAuditResult["keywords"] {
  const description = `${context?.productsServices ?? ""} ${context?.idealCustomer ?? ""}`.toLowerCase();
  const isRealEstate = /real estate|realtor|buy and sell homes|home buyer|home selling|property/.test(description);
  const topics = isRealEstate ? realEstateTopics : professionalTopics.map((topic, index) => index === 0 ? `${domain} services` : topic);
  return topics.map((keyword, index) => ({
    keyword,
    rank: index % 3 === 0 ? 11 + ((seed + index) % 35) : 0,
    searchVolume: 40 + ((seed + (index * 137)) % 950),
    url: index % 3 === 0 ? url : "",
    intent: /how|guide|questions|checklist|mistakes|update|versus|explained|expect|trends/.test(keyword) ? "informational" : "commercial",
    difficulty: 18 + ((seed + (index * 17)) % 55),
    cpc: 0.75 + (((seed + (index * 29)) % 650) / 100),
    opportunity: index % 3 === 0 ? "existing_rank" : index % 3 === 1 ? "competitor_gap" : "site_idea",
  }));
}

export function runDemoAudit(websiteValue: string, businessContext?: BusinessContext): SeoAuditResult {
  const website = normalizeWebsite(websiteValue);
  const seed = stableNumber(website.domain);
  const criticalIssues = 1 + (seed % 5);
  const issues: SeoAuditResult["issues"] = [
    { code: "missing_title", label: "Missing or weak page titles", severity: "critical" },
    { code: "broken_links", label: "Broken internal links", severity: "critical" },
    { code: "thin_content", label: "Pages with thin content", severity: "warning" },
  ];
  return {
    source: "demo",
    sourceLabel: "Demo audit data",
    domain: website.domain,
    fetchedAt: new Date().toISOString(),
    metrics: {
      criticalIssues,
      warnings: 4 + (seed % 8),
      rankingKeywords: 4 + (seed % 38),
      newKeywords: seed % 6,
      lostKeywords: seed % 3,
      estimatedOrganicTraffic: 40 + (seed % 900),
      contentGaps: 5 + (seed % 21),
      reviewCount: seed % 19,
      onPageScore: 62 + (seed % 28),
    },
    issues: issues.slice(0, Math.min(3, criticalIssues + 1)),
    competitors: [
      { domain: "local-search-competitor.example", sharedKeywords: 12 + (seed % 30) },
      { domain: "neighborhood-expert.example", sharedKeywords: 8 + (seed % 18) },
    ],
    keywords: demoKeywords(businessContext, website.domain, website.url, seed),
    notices: [
      "This is deterministic demonstration data, not a live SEO measurement.",
      "Add the DataForSEO API password to Supabase secrets to enable paid live checks.",
    ],
  };
}

function firstResult(payload: unknown) {
  const root = record(payload);
  const task = record(array(root.tasks)[0]);
  if (number(root.status_code) !== 20000 || number(task.status_code) !== 20000) {
    throw new Error(`DataForSEO rejected the audit: ${string(task.status_message) || string(root.status_message) || "Unknown API error"}`);
  }
  return record(array(task.result)[0]);
}

function authorization(login: string, password: string) {
  const bytes = new TextEncoder().encode(`${login}:${password}`);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `Basic ${btoa(binary)}`;
}

async function dataForSeoPost(path: string, body: JsonRecord[], login: string, password: string, timeout = 45_000) {
  const response = await fetch(`https://api.dataforseo.com${path}`, {
    method: "POST",
    headers: { Authorization: authorization(login, password), "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok) throw new Error(`DataForSEO returned HTTP ${response.status}.`);
  return response.json() as Promise<unknown>;
}

type StrategyKeyword = SeoAuditResult["keywords"][number];

function parseRankedKeywords(result: JsonRecord): StrategyKeyword[] {
  return array(result.items).slice(0, 25).map((item) => {
    const row = record(item);
    const keywordData = record(row.keyword_data);
    const keywordInfo = record(keywordData.keyword_info);
    const keywordProperties = record(keywordData.keyword_properties);
    const serpItem = record(record(row.ranked_serp_element).serp_item);
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

function parseKeywordIdeas(result: JsonRecord): StrategyKeyword[] {
  return array(result.items).slice(0, 25).map((item) => {
    const row = record(item);
    const keywordInfo = record(row.keyword_info);
    return {
      keyword: string(row.keyword),
      rank: 0,
      searchVolume: number(keywordInfo.search_volume),
      url: "",
      intent: string(record(row.search_intent_info).main_intent),
      difficulty: number(record(row.keyword_properties).keyword_difficulty),
      cpc: number(keywordInfo.cpc),
      opportunity: "site_idea" as const,
    };
  }).filter((keyword) => keyword.keyword);
}

function parseGapKeywords(result: JsonRecord): StrategyKeyword[] {
  return array(result.items).slice(0, 25).map((item) => {
    const keywordData = record(record(item).keyword_data);
    const keywordInfo = record(keywordData.keyword_info);
    const keywordProperties = record(keywordData.keyword_properties);
    return {
      keyword: string(keywordData.keyword),
      rank: 0,
      searchVolume: number(keywordInfo.search_volume),
      url: "",
      intent: string(record(keywordData.search_intent_info).main_intent) || string(keywordProperties.main_intent),
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

export function mergeKeywordStrategy(groups: StrategyKeyword[][], limit = 24) {
  const queues = groups.map((group) => [...group]);
  const seen = new Set<string>();
  const strategy: StrategyKeyword[] = [];
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

function buildKeywordStrategy(groups: StrategyKeyword[][], context: BusinessContext | undefined, limit = 24) {
  const contextValue = `${context?.productsServices ?? ""} ${context?.idealCustomer ?? ""} ${context?.market ?? ""}`.toLowerCase();
  const tokens = new Set(contextValue.split(/[^a-z0-9]+/).filter((token) => token.length >= 3 && !CONTEXT_STOP_WORDS.has(token)));
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

export async function runDataForSeoAudit(
  websiteValue: string,
  locationName: string,
  login: string,
  password: string,
  businessContext?: BusinessContext,
  knownCompetitors: Array<{ name: string; url?: string | null }> = [],
): Promise<SeoAuditResult> {
  const website = normalizeWebsite(websiteValue);
  const location = locationName.trim() || "United States";
  const [pagePayload, rankingsPayload, competitorsPayload, ideasPayload, homepageContent] = await Promise.all([
    dataForSeoPost("/v3/on_page/instant_pages", [{ url: website.url, enable_javascript: true }], login, password),
    dataForSeoPost("/v3/dataforseo_labs/google/ranked_keywords/live", [{
      target: website.domain, location_name: location, language_name: "English",
      item_types: ["organic", "local_pack", "featured_snippet"], limit: 24,
    }], login, password),
    dataForSeoPost("/v3/dataforseo_labs/google/competitors_domain/live", [{
      target: website.domain, location_name: location, language_name: "English",
      item_types: ["organic", "local_pack"], exclude_top_domains: true, limit: 5,
    }], login, password),
    dataForSeoPost("/v3/dataforseo_labs/google/keywords_for_site/live", [{
      target: website.domain,
      location_name: location,
      language_name: "English",
      filters: ["keyword_info.search_volume", ">", 0],
      order_by: ["relevance,desc", "keyword_info.search_volume,desc"],
      limit: 24,
    }], login, password),
    dataForSeoPost("/v3/on_page/content_parsing/live", [{ url: website.url, markdown_view: true }], login, password),
  ]);

  const pageResult = firstResult(pagePayload);
  const page = record(array(pageResult.items)[0]);
  const rankings = firstResult(rankingsPayload);
  const organicMetrics = record(record(rankings.metrics).organic);
  const competitorResult = firstResult(competitorsPayload);
  const competitors = array(competitorResult.items).slice(0, 5).map((item) => {
    const competitor = record(item);
    return { domain: string(competitor.domain), sharedKeywords: number(competitor.intersections) };
  }).filter((competitor) => competitor.domain && competitor.domain.toLowerCase().replace(/^www\./, "") !== website.domain);
  const rankedKeywords = parseRankedKeywords(rankings);
  const keywordIdeas = parseKeywordIdeas(firstResult(ideasPayload));

  const homepageResult = firstResult(homepageContent);
  const homepageItem = record(array(homepageResult.items)[0]);
  const parsedHomepage = parseContentPage(homepageItem, "homepage");
  parsedHomepage.url = website.url;
  const selectedPages = selectImportantPageLinks(website.url, parsedHomepage.links ?? []);
  const remainingPageResults = await Promise.allSettled(selectedPages.slice(1).map(async (selected) => {
    const payload = await dataForSeoPost("/v3/on_page/content_parsing/live", [{ url: selected.url, markdown_view: true }], login, password);
    const result = firstResult(payload);
    const item = record(array(result.items)[0]);
    const pageEvidence = parseContentPage(item, selected.role);
    pageEvidence.url = selected.url;
    return pageEvidence;
  }));
  const pages = [parsedHomepage, ...remainingPageResults.flatMap((result) => result.status === "fulfilled" ? [result.value] : [])]
    .filter((page) => page.text.trim())
    .slice(0, 5);
  const businessEvidence = `${businessContext?.productsServices ?? ""} ${businessContext?.idealCustomer ?? ""} ${businessContext?.market ?? ""}`.trim();
  const siteVocabulary = extractSiteVocabulary(pages, businessEvidence);

  const checks = record(page.checks);
  const issues: SeoAuditResult["issues"] = Object.entries(checks)
    .filter(([code, active]) => active === true && code in CHECK_LABELS)
    .map(([code]) => ({
      code,
      label: CHECK_LABELS[code] ?? code.replaceAll("_", " "),
      severity: CRITICAL_CHECKS.has(code) ? "critical" : "warning",
    }));
  if (page.broken_links === true && !issues.some((issue) => issue.code === "broken_links")) {
    issues.unshift({ code: "broken_links", label: "Page contains broken links", severity: "critical" });
  }

  const providedDomains = knownCompetitors.flatMap((competitor) => {
    if (!competitor.url) return [];
    try { return [normalizeWebsite(competitor.url).domain]; } catch { return []; }
  });
  const competitorDomains = [...new Set([...providedDomains, ...competitors.map((competitor) => competitor.domain)])]
    .filter((domain) => domain && domain !== website.domain)
    .slice(0, 5);
  if (competitorDomains.length < 2) {
    throw new Error("Destiny needs at least two resolvable competitor domains. Add competitor website URLs and retry.");
  }

  const gapPayloads = await Promise.all(competitorDomains.map((domain) => dataForSeoPost(
    "/v3/dataforseo_labs/google/domain_intersection/live",
    [{
      target1: domain,
      target2: website.domain,
      location_name: location,
      language_name: "English",
      intersections: false,
      item_types: ["organic", "local_pack"],
      filters: ["keyword_data.keyword_info.search_volume", ">", 0],
      order_by: ["keyword_data.keyword_info.search_volume,desc"],
      limit: 150,
    }],
    login,
    password,
  )));
  const gapGroups = gapPayloads.map((payload) => parseGapKeywords(firstResult(payload)));
  const competitorRankCounts = new Map<string, number>();
  const gapByKeyword = new Map<string, StrategyKeyword>();
  for (const group of gapGroups) {
    const seenInCompetitor = new Set<string>();
    for (const keyword of group) {
      const key = keywordIdentity(keyword.keyword);
      if (!key || seenInCompetitor.has(key)) continue;
      seenInCompetitor.add(key);
      competitorRankCounts.set(key, (competitorRankCounts.get(key) ?? 0) + 1);
      const existing = gapByKeyword.get(key);
      if (!existing || keyword.searchVolume > existing.searchVolume) gapByKeyword.set(key, keyword);
    }
  }
  const gapKeywords = [...gapByKeyword.values()].sort((a, b) =>
    (competitorRankCounts.get(keywordIdentity(b.keyword)) ?? 0) - (competitorRankCounts.get(keywordIdentity(a.keyword)) ?? 0)
      || b.searchVolume - a.searchVolume
      || a.keyword.localeCompare(b.keyword));
  const strategyCandidates = mergeKeywordStrategy([rankedKeywords, gapKeywords, keywordIdeas], 36);
  const keywords = await Promise.all(strategyCandidates.map(async (keyword) => {
    const competitorRankers = competitorRankCounts.get(keywordIdentity(keyword.keyword)) ?? 0;
    const facts = buildKeywordFacts(keyword.keyword, siteVocabulary, competitorRankers);
    const decision = await runDestinyLogic({
      auditComplete: 1,
      criticalIssues: 0,
      warnings: 0,
      rankingKeywords: rankedKeywords.length,
      newKeywords: 0,
      lostKeywords: 0,
      contentGaps: gapKeywords.length,
      reviewCount: 0,
      keywordCoreMatches: facts.coreMatches,
      keywordSupportMatches: facts.supportMatches,
      competitorRankers: facts.competitorRankers,
      keywordBlocklisted: facts.blocklisted ? 1 : 0,
      planTier: 1,
    });
    return {
      ...keyword,
      normalizedKeyword: facts.normalizedKeyword,
      matchedTerms: facts.matchedTerms,
      competitorRankers,
      verdict: decision.keywordVerdict,
      ruleId: decision.keywordRuleId,
      reason: decision.keywordReason,
      essential: decision.essentialKeyword,
    };
  }));

  const firstAcceptedKeyword = keywords.find((keyword) => keyword.essential)
    ?? keywords.find((keyword) => keyword.verdict === "accept")
    ?? keywords.find((keyword) => keyword.verdict === "review");
  const distributionTopic = firstAcceptedKeyword?.keyword ?? siteVocabulary.find((term) => term.term.includes(" "))?.term ?? website.domain;
  const [redditResult, quoraResult, llmResult] = await Promise.allSettled([
    dataForSeoPost("/v3/serp/google/organic/live/advanced", [{ keyword: `reddit ${distributionTopic}`, location_name: location, language_code: "en", depth: 10 }], login, password),
    dataForSeoPost("/v3/serp/google/organic/live/advanced", [{ keyword: `quora ${distributionTopic}`, location_name: location, language_code: "en", depth: 10 }], login, password),
    dataForSeoPost("/v3/ai_optimization/llm_mentions/target_metrics/live", [{
      target: [{ domain: website.domain, search_filter: "include" }],
      location_code: 2840,
      language_code: "en",
      internal_list_limit: 10,
    }], login, password, 125_000),
  ]);
  const distributionOpportunities = [redditResult, quoraResult].flatMap((result) => result.status === "fulfilled"
    ? parseDistributionSerp(result.value, distributionTopic)
    : []).filter((item, index, all) => all.findIndex((candidate) => candidate.url === item.url) === index).slice(0, 8);
  const llmVisibility = llmResult.status === "fulfilled"
    ? parseLlmVisibility(llmResult.value, llmResult.value)
    : { status: "unavailable" as const, totalMentions: 0, aiSearchVolume: 0, platforms: [], topCitedDomains: [], reason: "DataForSEO LLM visibility did not finish within this audit window." };

  const analyzedCompetitors = competitorDomains.map((domain) => ({
    domain,
    sharedKeywords: competitors.find((competitor) => competitor.domain === domain)?.sharedKeywords ?? 0,
  }));
  const acceptedGapCount = keywords.filter((keyword) => keyword.opportunity === "competitor_gap" && keyword.verdict === "accept").length;

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
      contentGaps: acceptedGapCount,
      reviewCount: 0,
      onPageScore: typeof page.onpage_score === "number" ? page.onpage_score : null,
    },
    issues: issues.slice(0, 10),
    competitors: analyzedCompetitors,
    keywords,
    pages,
    siteVocabulary,
    distributionOpportunities,
    llmVisibility,
    notices: [
      "Keyword and competitor indexes are DataForSEO estimates updated on their provider schedule.",
      `Destiny inspected ${pages.length} important page${pages.length === 1 ? "" : "s"} and LOGOS accepted, routed for review, or rejected each keyword with a traceable rule.`,
      `Competitor gaps were checked across ${competitorDomains.length} competitor domains; essential gaps require support from at least two.`,
      distributionOpportunities.length ? "Distribution links point to individual live Reddit or Quora threads." : "No individual Reddit or Quora thread passed Destiny's live-link check in this audit.",
      "Google review count stays at zero until Google Business Profile is connected.",
    ],
  };
}

export async function runSeoAudit(input: {
  website: string;
  locationName?: string;
  login?: string;
  password?: string;
  businessContext?: BusinessContext;
  knownCompetitors?: Array<{ name: string; url?: string | null }>;
}) {
  if (input.login && input.password) {
    return runDataForSeoAudit(input.website, input.locationName || "United States", input.login, input.password, input.businessContext, input.knownCompetitors);
  }
  return runDemoAudit(input.website, input.businessContext);
}
