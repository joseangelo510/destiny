export type PageRole = "homepage" | "product" | "how_it_works" | "about" | "contact" | "other";

export type SitePageEvidence = {
  url: string;
  role: PageRole;
  text: string;
  title?: string;
};

export type SiteVocabularyTerm = {
  term: string;
  normalized: string;
  weight: number;
  sourcePages: PageRole[];
  evidence: string;
};

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
  } catch {
    return null;
  }
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

const STOP_WORDS = new Set([
  "about", "after", "again", "also", "and", "are", "because", "been", "before", "being", "best", "between", "business", "can", "contact", "each", "for", "from", "get", "have", "help", "here", "into", "more", "our", "page", "people", "provide", "services", "that", "the", "their", "them", "they", "this", "through", "top", "use", "want", "what", "when", "where", "which", "who", "will", "with", "you", "your",
]);

export function normalizeTerm(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((token) => /^(?:consulting|consultants?)$/.test(token) ? "consult"
      : token.length > 4 && token.endsWith("ies") ? `${token.slice(0, -3)}y`
      : token.length > 4 && token.endsWith("s") && !token.endsWith("ss") ? token.slice(0, -1)
      : token)
    .join(" ");
}

function cleanTokens(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token) && !/^\d+$/.test(token));
}

const ROLE_WEIGHT: Record<PageRole, number> = {
  homepage: 3,
  product: 5,
  how_it_works: 3,
  about: 2,
  contact: 1,
  other: 2,
};

export function extractSiteVocabulary(pages: SitePageEvidence[], businessContext = "", limit = 60): SiteVocabularyTerm[] {
  const rows = businessContext.trim()
    ? [...pages, { url: "onboarding://business-context", role: "product" as const, text: businessContext }]
    : pages;
  const collected = new Map<string, { term: string; normalized: string; weight: number; sourcePages: Set<PageRole>; evidence: string }>();

  for (const page of rows) {
    const tokens = cleanTokens(`${page.title ?? ""} ${page.text}`);
    for (let index = 0; index < tokens.length; index += 1) {
      for (const size of [1, 2, 3]) {
        const phraseTokens = tokens.slice(index, index + size);
        if (phraseTokens.length !== size) continue;
        const term = phraseTokens.join(" ");
        const normalized = normalizeTerm(term);
        if (!normalized || normalized.length < 3) continue;
        const phraseBoost = size === 2 ? 2.5 : size === 3 ? 1.5 : 1;
        const existing = collected.get(normalized) ?? {
          term,
          normalized,
          weight: 0,
          sourcePages: new Set<PageRole>(),
          evidence: page.text.trim().slice(0, 180),
        };
        existing.weight += ROLE_WEIGHT[page.role] * phraseBoost;
        existing.sourcePages.add(page.role);
        collected.set(normalized, existing);
      }
    }
  }

  for (const candidate of collected.values()) {
    if (!candidate.normalized.includes(" ")) continue;
    const candidateTokens = candidate.normalized.split(" ");
    for (const page of rows) {
      const pageTokens = new Set(cleanTokens(`${page.title ?? ""} ${page.text}`).map(normalizeTerm));
      if (candidateTokens.every((token) => pageTokens.has(token))) {
        candidate.weight += ROLE_WEIGHT[page.role];
        candidate.sourcePages.add(page.role);
      }
    }
  }

  const singleTokenWeights = new Map(
    [...collected.values()]
      .filter((candidate) => !candidate.normalized.includes(" "))
      .map((candidate) => [candidate.normalized, candidate.weight]),
  );
  for (const candidate of collected.values()) {
    const candidateTokens = candidate.normalized.split(" ");
    if (candidateTokens.length < 2) continue;
    const componentWeights = candidateTokens.map((token) => singleTokenWeights.get(token) ?? 0);
    candidate.weight += Math.min(...componentWeights) * (candidateTokens.length === 2 ? 1.25 : 0.5);
  }

  return [...collected.values()]
    .filter((term) => term.normalized.split(" ").length > 1 || term.weight >= 5)
    .sort((a, b) => b.weight - a.weight || b.sourcePages.size - a.sourcePages.size || a.term.localeCompare(b.term))
    .slice(0, limit)
    .map((term) => ({ ...term, weight: Math.round(term.weight * 10) / 10, sourcePages: [...term.sourcePages] }));
}

export function buildKeywordFacts(keyword: string, vocabulary: SiteVocabularyTerm[], competitorRankers = 0) {
  const normalizedKeyword = normalizeTerm(keyword);
  const meaningfulKeywordTokens = cleanTokens(keyword).map(normalizeTerm).filter(Boolean);
  const keywordTokens = new Set(meaningfulKeywordTokens);
  const matches = vocabulary.filter((term) => {
    const termTokens = normalizeTerm(term.normalized).split(/\s+/).filter(Boolean);
    return termTokens.length > 0 && termTokens.every((token) => keywordTokens.has(token));
  });
  const coreCandidates = matches.filter((term) => term.weight >= 5 && (term.sourcePages.includes("product") || term.sourcePages.includes("homepage")));
  const coveredCoreTokens = new Set(coreCandidates.flatMap((term) => normalizeTerm(term.normalized).split(/\s+/).filter(Boolean)));
  const coverage = meaningfulKeywordTokens.length
    ? meaningfulKeywordTokens.filter((token) => coveredCoreTokens.has(token)).length / meaningfulKeywordTokens.length
    : 0;
  const coreMatches = coverage >= 0.75 ? coreCandidates.length : 0;
  const supportMatches = matches.length;
  const blocklisted = /\b(?:login|sign in|password|portal|torrent|download free|jobs?|careers?)\b/i.test(keyword);
  return {
    normalizedKeyword,
    matchedTerms: matches.slice(0, 8).map((term) => term.term),
    coreMatches,
    supportMatches,
    competitorRankers,
    blocklisted,
  };
}
