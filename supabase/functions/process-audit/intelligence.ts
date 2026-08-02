export type PageRole = "homepage" | "product" | "how_it_works" | "about" | "contact" | "other";

export type SitePageEvidence = {
  url: string;
  role: PageRole;
  text: string;
  title?: string;
  links?: string[];
};

export type SiteVocabularyTerm = {
  term: string;
  normalized: string;
  weight: number;
  sourcePages: PageRole[];
  evidence: string;
};

type JsonRecord = Record<string, unknown>;
function record(value: unknown): JsonRecord { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {}; }
function list(value: unknown) { return Array.isArray(value) ? value : []; }
function text(value: unknown) { return typeof value === "string" ? value : ""; }
function number(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? value : 0; }

const ROLE_PATTERNS: Array<{ role: Exclude<PageRole, "homepage" | "other">; pattern: RegExp }> = [
  { role: "product", pattern: /\/(?:products?|services?|solutions?|industr(?:y|ies)|programs?|platform|what-we-do)(?:\/|$)/i },
  { role: "how_it_works", pattern: /\/(?:how-it-works|how_it_works|process|our-process|methodology|approach)(?:\/|$)/i },
  { role: "about", pattern: /\/(?:about|about-us|our-story|company|team)(?:\/|$)/i },
  { role: "contact", pattern: /\/(?:contact|contact-us|get-in-touch|book|consultation)(?:\/|$)/i },
];

const ROLE_FALLBACK_PATHS: Record<Exclude<PageRole, "homepage" | "other">, string> = {
  product: "/services",
  how_it_works: "/how-it-works",
  about: "/about",
  contact: "/contact",
};

function normalizedUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
    return url;
  } catch { return null; }
}

function pageRole(url: URL): PageRole {
  return ROLE_PATTERNS.find((entry) => entry.pattern.test(url.pathname))?.role ?? "other";
}

export function selectImportantPageLinks(homepage: string, links: string[], limit = 5) {
  const home = normalizedUrl(homepage);
  if (!home) return [];
  home.pathname = "/";
  const candidates = new Map<string, { url: string; role: PageRole }>();
  for (const value of links) {
    const resolved = normalizedUrl(new URL(value, home).toString());
    if (!resolved || resolved.hostname.replace(/^www\./, "") !== home.hostname.replace(/^www\./, "")) continue;
    if (!/^https?:$/.test(resolved.protocol) || /\.(?:pdf|jpg|jpeg|png|gif|svg|zip)$/i.test(resolved.pathname)) continue;
    const normalized = resolved.toString();
    if (normalized === home.toString()) continue;
    candidates.set(normalized, { url: normalized, role: pageRole(resolved) });
  }
  const selected: Array<{ url: string; role: PageRole }> = [{ url: home.toString(), role: "homepage" }];
  for (const role of ["product", "how_it_works", "about", "contact"] as const) {
    const match = [...candidates.values()].find((candidate) => candidate.role === role);
    if (selected.length >= limit) break;
    selected.push(match ?? { url: new URL(ROLE_FALLBACK_PATHS[role], home).toString(), role });
  }
  for (const candidate of candidates.values()) {
    if (selected.length >= limit) break;
    if (!selected.some((page) => page.url === candidate.url)) selected.push(candidate);
  }
  return selected;
}

export function parseContentPage(value: unknown, role: PageRole): SitePageEvidence {
  const page = record(value);
  const markdown = text(page.page_as_markdown);
  const links = [
    ...list(page.links).map((item) => typeof item === "string" ? item : text(record(item).url)),
    ...[...markdown.matchAll(/\[[^\]]*\]\((https?:\/\/[^)\s]+|\/[^)\s]+)\)/g)].map((match) => match[1]),
  ].filter(Boolean);
  const fallback = [text(page.title), text(page.description), text(page.content)].filter(Boolean).join("\n");
  return {
    url: text(page.url),
    role,
    title: text(page.title),
    text: (markdown || fallback).slice(0, 60_000),
    links,
  };
}

const STOP_WORDS = new Set([
  "about", "after", "again", "also", "and", "are", "because", "been", "before", "being", "best", "between", "business", "can", "contact", "each", "for", "from", "get", "have", "help", "here", "into", "more", "our", "page", "people", "provide", "services", "that", "the", "their", "them", "they", "this", "through", "top", "use", "want", "what", "when", "where", "which", "who", "will", "with", "you", "your",
]);

export function normalizeTerm(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/)
    .map((token) => /^(?:consulting|consultants?)$/.test(token) ? "consult"
      : token.length > 4 && token.endsWith("ies") ? `${token.slice(0, -3)}y`
      : token.length > 4 && token.endsWith("s") && !token.endsWith("ss") ? token.slice(0, -1) : token).join(" ");
}

function cleanTokens(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token) && !/^\d+$/.test(token));
}

export function boundedEvidenceTokens(value: string, budget = 1_200) {
  const tokens = cleanTokens(value);
  if (tokens.length <= budget) return tokens;
  const tailCount = Math.min(200, budget);
  return [...tokens.slice(0, budget - tailCount), ...tokens.slice(-tailCount)];
}

const ROLE_WEIGHT: Record<PageRole, number> = { homepage: 3, product: 5, how_it_works: 3, about: 2, contact: 1, other: 2 };

export function extractSiteVocabulary(pages: SitePageEvidence[], businessContext = "", limit = 60): SiteVocabularyTerm[] {
  const rows = businessContext.trim() ? [...pages, { url: "onboarding://business-context", role: "product" as const, text: businessContext }] : pages;
  const preparedRows = rows.map((page) => {
    const tokens = boundedEvidenceTokens(`${page.title ?? ""} ${page.text}`);
    return { page, tokens, tokenSet: new Set(tokens.map(normalizeTerm)) };
  });
  const collected = new Map<string, { term: string; normalized: string; weight: number; sourcePages: Set<PageRole>; evidence: string }>();
  for (const { page, tokens } of preparedRows) {
    for (let index = 0; index < tokens.length; index += 1) {
      for (const size of [1, 2, 3]) {
        const phraseTokens = tokens.slice(index, index + size);
        if (phraseTokens.length !== size) continue;
        const term = phraseTokens.join(" ");
        const normalized = normalizeTerm(term);
        if (!normalized || normalized.length < 3) continue;
        const phraseBoost = size === 2 ? 2.5 : size === 3 ? 1.5 : 1;
        const existing = collected.get(normalized) ?? { term, normalized, weight: 0, sourcePages: new Set<PageRole>(), evidence: page.text.trim().slice(0, 180) };
        existing.weight += ROLE_WEIGHT[page.role] * phraseBoost;
        existing.sourcePages.add(page.role);
        collected.set(normalized, existing);
      }
    }
  }
  for (const candidate of collected.values()) {
    if (!candidate.normalized.includes(" ")) continue;
    const candidateTokens = candidate.normalized.split(" ");
    for (const { page, tokenSet } of preparedRows) {
      if (candidateTokens.every((token) => tokenSet.has(token))) {
        candidate.weight += ROLE_WEIGHT[page.role];
        candidate.sourcePages.add(page.role);
      }
    }
  }
  const singleTokenWeights = new Map([...collected.values()].filter((candidate) => !candidate.normalized.includes(" ")).map((candidate) => [candidate.normalized, candidate.weight]));
  for (const candidate of collected.values()) {
    const candidateTokens = candidate.normalized.split(" ");
    if (candidateTokens.length < 2) continue;
    const componentWeights = candidateTokens.map((token) => singleTokenWeights.get(token) ?? 0);
    candidate.weight += Math.min(...componentWeights) * (candidateTokens.length === 2 ? 1.25 : 0.5);
  }
  return [...collected.values()].filter((term) => term.normalized.split(" ").length > 1 || term.weight >= 5)
    .sort((a, b) => b.weight - a.weight || b.sourcePages.size - a.sourcePages.size || a.term.localeCompare(b.term)).slice(0, limit)
    .map((term) => ({ ...term, weight: Math.round(term.weight * 10) / 10, sourcePages: [...term.sourcePages] }));
}

export function buildKeywordFacts(keyword: string, vocabulary: SiteVocabularyTerm[], competitorRankers = 0) {
  const normalizedKeyword = normalizeTerm(keyword);
  const meaningfulKeywordTokens = cleanTokens(keyword).map(normalizeTerm).filter(Boolean);
  const keywordTokens = new Set(meaningfulKeywordTokens);
  const matches = vocabulary.filter((term) => normalizeTerm(term.normalized).split(/\s+/).filter(Boolean).every((token) => keywordTokens.has(token)));
  const coreCandidates = matches.filter((term) => term.weight >= 5 && (term.sourcePages.includes("product") || term.sourcePages.includes("homepage")));
  const coveredCoreTokens = new Set(coreCandidates.flatMap((term) => normalizeTerm(term.normalized).split(/\s+/).filter(Boolean)));
  const coverage = meaningfulKeywordTokens.length ? meaningfulKeywordTokens.filter((token) => coveredCoreTokens.has(token)).length / meaningfulKeywordTokens.length : 0;
  const coreMatches = coverage >= 0.75 ? coreCandidates.length : 0;
  return {
    normalizedKeyword,
    matchedTerms: matches.slice(0, 8).map((term) => term.term),
    coreMatches,
    supportMatches: matches.length,
    competitorRankers,
    blocklisted: /\b(?:login|sign in|password|portal|torrent|download free|jobs?|careers?)\b/i.test(keyword),
  };
}

export type DistributionOpportunity = {
  platform: "Reddit" | "Quora";
  topic: string;
  title: string;
  url: string;
  snippet: string;
  checkedAt: string;
};

export function parseDistributionSerp(payload: unknown, topic: string): DistributionOpportunity[] {
  const root = record(payload);
  const task = record(list(root.tasks)[0]);
  if (root.status_code !== 20000 || task.status_code !== 20000) return [];
  const result = record(list(task.result)[0]);
  const checkedAt = new Date().toISOString();
  return list(result.items).map(record).flatMap((item) => {
    if (item.type !== "organic") return [];
    let url: URL;
    try { url = new URL(text(item.url)); } catch { return []; }
    const host = url.hostname.toLocaleLowerCase().replace(/^www\./, "");
    const isReddit = host === "reddit.com" && /\/comments\/[a-z0-9]+\//i.test(url.pathname);
    const isQuora = host === "quora.com" && url.pathname.length > 2 && !/^\/(?:search|topic|profile)(?:\/|$)/i.test(url.pathname);
    if (!isReddit && !isQuora) return [];
    return [{
      platform: isReddit ? "Reddit" as const : "Quora" as const,
      topic,
      title: text(item.title) || topic,
      url: url.toString(),
      snippet: text(item.description).slice(0, 300),
      checkedAt,
    }];
  });
}

function firstResult(payload: unknown) {
  const root = record(payload);
  const task = record(list(root.tasks)[0]);
  if (root.status_code !== 20000 || task.status_code !== 20000) return {};
  return record(list(task.result)[0]);
}

function companyFromDomain(domain: string) {
  const root = domain.replace(/^www\./, "").split(".")[0].replace(/[-_]+/g, " ");
  return root ? root.charAt(0).toUpperCase() + root.slice(1) : domain;
}

export type LlmVisibility = {
  status: "available" | "unavailable";
  totalMentions: number;
  aiSearchVolume: number;
  platforms: Array<{ platform: string; mentions: number; aiSearchVolume: number }>;
  topCitedDomains: Array<{ company: string; domain: string; website: string; mentions: number; aiSearchVolume: number }>;
  reason?: string;
};

export function parseLlmVisibility(targetMetricsPayload: unknown, topDomainsPayload: unknown): LlmVisibility {
  const metricsResult = firstResult(targetMetricsPayload);
  const platforms = list(record(metricsResult.aggregated_metrics).platform).map(record).map((item) => ({
    platform: text(item.key) === "chat_gpt" ? "ChatGPT" : text(item.key) === "google" ? "Google AI Overviews" : text(item.key),
    mentions: number(item.mentions),
    aiSearchVolume: number(item.ai_search_volume),
  })).filter((item) => item.platform);
  const domainsResult = firstResult(topDomainsPayload);
  const domainRows = list(domainsResult.items).length ? list(domainsResult.items) : list(record(metricsResult.aggregated_metrics).sources_domain);
  const topCitedDomains = domainRows.map(record).map((item) => {
    const domain = text(item.key).replace(/^www\./, "");
    const domainPlatforms = list(item.platform).map(record);
    return {
      company: companyFromDomain(domain), domain, website: `https://${domain}`,
      mentions: domainPlatforms.length ? domainPlatforms.reduce((total, row) => total + number(row.mentions), 0) : number(item.mentions),
      aiSearchVolume: domainPlatforms.length ? domainPlatforms.reduce((total, row) => total + number(row.ai_search_volume), 0) : number(item.ai_search_volume),
    };
  }).filter((item) => item.domain).sort((a, b) => b.mentions - a.mentions).slice(0, 10);
  const available = Boolean(platforms.length || topCitedDomains.length);
  return {
    status: available ? "available" : "unavailable",
    totalMentions: platforms.reduce((total, item) => total + item.mentions, 0),
    aiSearchVolume: platforms.reduce((total, item) => total + item.aiSearchVolume, 0),
    platforms,
    topCitedDomains,
    ...(available ? {} : { reason: "DataForSEO did not return LLM mention data for this target yet." }),
  };
}
