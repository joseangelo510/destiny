import type { BusinessSearchBrief, KeywordTheme } from "./business-search-brief.ts";

export type KeywordCandidate = {
  keyword: string;
  rank?: number;
  searchVolume?: number;
  difficulty?: number;
  cpc?: number;
  intent?: string;
  opportunity?: string;
  competitorRankers?: number;
  directCompetitorRankers?: number;
  [key: string]: unknown;
};

export type KeywordBusinessContext = {
  businessName?: string;
  productsServices?: string;
  problemSolved?: string;
  idealCustomer?: string;
  audienceChallengesGoals?: string;
  differentiation?: string;
  market?: string;
  /** Concatenated page-text evidence from the scanned website pages. */
  pageText?: string;
};

export type ProviderIntent = "transactional" | "commercial" | "navigational" | "informational";
export type CustomerIntent = "conversion" | "consideration" | "awareness";

export type RankedKeywordOpportunity<T extends KeywordCandidate = KeywordCandidate> = T & {
  providerIntent: ProviderIntent;
  searchIntent: CustomerIntent;
  businessFit: number;
  revenueFit: number;
  relevanceTier: "core" | "adjacent";
  priorityTier: 1 | 2 | 3 | 4;
  priorityScore: number;
  priorityReason: string;
  themeId: string;
  themeLabel: string;
  themeRole: KeywordTheme["funnelRole"];
};

// Valid themeRole values — used to validate a persisted candidate's themeRole before forwarding it.
const VALID_THEME_ROLES = new Set<string>(["conversion", "consideration", "awareness", "technical_authority"]);

const STOP_WORDS = new Set([
  "a", "about", "and", "are", "as", "at", "be", "best", "business", "by", "customer", "customers", "expert", "for", "from", "get", "good", "help", "high", "in", "into", "is", "it", "local", "of", "on", "online", "or", "our", "people", "private", "provide", "service", "services", "that", "the", "their", "them", "they", "this", "to", "top", "want", "we", "who", "with", "you", "your",
]);

const TOKEN_FAMILIES: Record<string, string> = {
  admission: "admission", admissions: "admission",
  accept: "admission", acceptance: "admission", accepted: "admission",
  application: "application", applications: "application", applying: "application", apply: "application",
  advisor: "guidance", advisors: "guidance", advising: "guidance",
  coach: "guidance", coaches: "guidance", coaching: "guidance",
  consultant: "guidance", consultants: "guidance", consulting: "guidance",
  counselor: "guidance", counselors: "guidance", counseling: "guidance",
  college: "college", colleges: "college", universities: "college", university: "college",
  essay: "essay", essays: "essay",
  parent: "family", parents: "family", families: "family", family: "family",
  student: "student", students: "student",
};

const TRANSACTIONAL = /\b(?:book|buy|call|cost|coupon|discount|fees?|for sale|hire|near me|order|price|prices|pricing|promo code|quote|schedule|sign up|subscribe)\b/i;
const COMMERCIAL = /\b(?:affordable|alternative|alternatives|best|coach|coaches|coaching|compare|comparison|consultant|consultants|consulting|counseling|counselor|counselors|reviews?|services?|top|versus|vs\.?)\b/i;
const INFORMATIONAL = /^(?:how|what|when|where|why|guide|tips?|examples?|ideas?|checklist)\b/i;
const NOISE = /\b(?:careers?|jobs?|login|password|portal|sign in|torrent|download free)\b/i;
const SERVICE_BUSINESS = /\b(?:agency|coach|coaching|consultant|consulting|counseling|counselor|guidance|service|services)\b/i;
const SOFTWARE_PRODUCT = /\b(?:app|apps|crm|platform|saas|software|system|tool|tools)\b/i;
const BUYER_ACTION = /\b(?:book|buy|call|companies|company|consultation|cost|fees?|hire|near me|price|prices|pricing|quote|reviews?|schedule|sign up)\b/i;
const COMPARISON_ACTION = /\b(?:alternative|alternatives|best|compare|comparison|reviews?|top|versus|vs\.?)\b/i;
const INSTITUTION = /\b(?:academy|colleges?|school|universit(?:y|ies))\b/i;
const INSTITUTION_RESEARCH = /\b(?:acceptance rate|admissions?|application|best|deadline|essay|get into|requirements?|ranking|top|tuition)\b/i;
const SCHOOL_RESEARCH_WITHOUT_INSTITUTION_SUFFIX = /\b(?:acceptance rate|admissions? requirements?|how to get into)\b/i;
const GRADUATE_AUDIENCE = /\b(?:business school|graduate school|law school|mba|medical school|phd)\b/i;
const HIGH_SCHOOL_AUDIENCE = /\b(?:high school|teen|undergraduate)\b/i;
const GENERIC_OFFER_TOKENS = new Set(["advice", "application", "guidance", "management", "planning", "solution", "strategy", "support"]);

function canonicalToken(token: string) {
  const explicit = TOKEN_FAMILIES[token];
  if (explicit) return explicit;
  if (token.length > 5 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length > 4 && token.endsWith("ing")) return token.slice(0, -3);
  if (token.length > 4 && token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
}

function canonicalTokens(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token) && !/^\d+$/.test(token))
    .map(canonicalToken);
}

function contextProfile(context: KeywordBusinessContext) {
  const productsServices = context.productsServices ?? "";
  const description = [
    productsServices,
    context.problemSolved,
    context.idealCustomer,
    context.audienceChallengesGoals,
    context.differentiation,
    context.market,
  ].filter(Boolean).join(" ");
  return {
    offer: new Set(canonicalTokens(productsServices)),
    all: new Set(canonicalTokens(description)),
    description,
  };
}

function isNoise(keyword: string) {
  const normalized = keyword.trim();
  if (!normalized || NOISE.test(normalized)) return true;
  const tokens = normalized.match(/[a-z]+|\d+/gi) ?? [];
  const numeric = tokens.filter((token) => /^\d+$/.test(token)).length;
  return numeric >= 2 && numeric / Math.max(tokens.length, 1) >= 0.4;
}

function inferIntent(candidate: KeywordCandidate): ProviderIntent {
  if (TRANSACTIONAL.test(candidate.keyword)) return "transactional";
  const supplied = String(candidate.intent ?? "").toLowerCase();
  if (supplied.includes("transaction") || supplied.includes("conversion")) return "transactional";
  if (supplied.includes("commercial") || supplied.includes("consideration")) return "commercial";
  if (supplied.includes("navigation")) return "navigational";
  if (supplied.includes("information") || supplied.includes("awareness")) return "informational";
  if (COMMERCIAL.test(candidate.keyword)) return "commercial";
  if (INFORMATIONAL.test(candidate.keyword)) return "informational";
  return "informational";
}

function customerIntent(intent: ProviderIntent): CustomerIntent {
  if (intent === "transactional") return "conversion";
  if (intent === "commercial" || intent === "navigational") return "consideration";
  return "awareness";
}

function intentPoints(intent: ProviderIntent) {
  return 25 * ({ transactional: 1, commercial: 0.85, navigational: 0.25, informational: 0.3 }[intent]);
}

function opportunityPoints(candidate: KeywordCandidate) {
  const rank = Math.max(0, Number(candidate.rank ?? 0));
  const competitors = Math.max(0, Number(candidate.competitorRankers ?? 0));
  const directCompetitors = Math.max(0, Number(candidate.directCompetitorRankers ?? 0));
  if (candidate.opportunity === "existing_rank" && rank >= 4 && rank <= 20) return 5;
  if (candidate.opportunity === "competitor_gap" && directCompetitors > 0) return Math.min(5, 3 + directCompetitors);
  if (candidate.opportunity === "competitor_gap") return Math.min(3, 1 + competitors * 0.5);
  if (candidate.opportunity === "existing_rank") return 4;
  return 2;
}

function priorityReason(candidate: KeywordCandidate, intent: ProviderIntent, relevanceTier: "core" | "adjacent", themeLabel?: string) {
  const label = intent === "transactional" ? "Buying intent"
    : intent === "commercial" ? "Comparison intent"
      : intent === "navigational" ? "Brand-finding intent"
        : "Learning intent";
  const volume = Math.max(0, Number(candidate.searchVolume ?? 0)).toLocaleString();
  const rank = Math.max(0, Number(candidate.rank ?? 0));
  const competitors = Math.max(0, Number(candidate.competitorRankers ?? 0));
  const directCompetitors = Math.max(0, Number(candidate.directCompetitorRankers ?? 0));
  const evidence = candidate.opportunity === "competitor_gap" && directCompetitors
    ? `${directCompetitors} direct competitor${directCompetitors === 1 ? "" : "s"} rank, you do not`
    : candidate.opportunity === "competitor_gap"
    ? `${competitors || "Competitors"} competitor${competitors === 1 ? "" : "s"} rank, you do not`
    : candidate.opportunity === "existing_rank" && rank
      ? `you rank #${rank}`
      : "new relevant opportunity";
  const relevance = relevanceTier === "core" ? "Core service match" : "Supporting topic";
  return `${label} · ${relevance}${themeLabel ? ` (${themeLabel})` : ""} · ${volume} monthly searches · ${evidence}`;
}

function audienceConflict(keyword: string, contextDescription: string) {
  return HIGH_SCHOOL_AUDIENCE.test(contextDescription) && GRADUATE_AUDIENCE.test(keyword);
}

// Major US city/metro phrases. A keyword that contains one of these but the
// website's page text does not is almost certainly a location the business
// does not serve — reject it from non-ranking candidates.
const US_CITY_PHRASES: readonly string[] = [
  "los angeles", "manhattan", "new york city", "nyc", "brooklyn",
  "boston", "houston", "green bay", "seattle", "chicago", "philadelphia",
  "fremont", "bay area", "san francisco", "san jose", "san diego",
  "dallas", "austin", "denver", "miami", "atlanta", "phoenix",
  "minneapolis", "portland", "las vegas", "detroit", "baltimore",
  "washington dc",
  "columbus", "madison", "roswell", "tucson", "york pa",
];

/**
 * Returns true when a keyword contains a US city phrase that does not appear
 * in the website's page-text evidence, meaning the site likely does not serve
 * that location. Always returns false for existing-ranking keywords — preserve
 * those regardless.
 */
export function keywordHasGeographicConflict(keyword: string, evidence: string): boolean {
  if (!evidence.trim()) return false;
  const kw = keyword.toLowerCase();
  const ev = evidence.toLowerCase();
  return US_CITY_PHRASES.some((city) => kw.includes(city) && !ev.includes(city));
}

function revenueFit(keyword: string, intent: ProviderIntent) {
  const service = SERVICE_BUSINESS.test(keyword);
  const buyerAction = BUYER_ACTION.test(keyword);
  const comparison = COMPARISON_ACTION.test(keyword);
  if (service && buyerAction) return 1;
  if (service && (intent === "transactional" || intent === "commercial")) return comparison ? 1 : 0.85;
  if (buyerAction && intent === "transactional") return 0.65;
  if (comparison && intent === "commercial") return 0.25;
  if (intent === "transactional") return 0.45;
  if (intent === "commercial") return 0.2;
  return 0.12;
}

function priorityTier(relevanceTier: "core" | "adjacent", revenue: number): 1 | 2 | 3 | 4 {
  if (relevanceTier === "core" && revenue >= 0.85) return 1;
  if (relevanceTier === "core" && revenue >= 0.45) return 2;
  if (relevanceTier === "core") return 3;
  return 4;
}

function phraseMatches(keywordTokens: Set<string>, phrase: string) {
  const terms = canonicalTokens(phrase);
  return terms.length > 0 && terms.every((term) => keywordTokens.has(term));
}

function keywordThemeMatch(keyword: string, brief: BusinessSearchBrief) {
  const keywordTokens = new Set(canonicalTokens(keyword));
  if (!keywordTokens.size) return null;
  if (brief.offerVsEnablement.notTheOffer.some((phrase) => phraseMatches(keywordTokens, phrase))) return null;
  let best: { theme: KeywordTheme; score: number } | null = null;
  for (const theme of brief.themes) {
    if (theme.negativeTerms.some((phrase) => phraseMatches(keywordTokens, phrase))) continue;
    const requiredMatches = theme.requiredTerms.filter((phrase) => phraseMatches(keywordTokens, phrase)).length;
    const seedEvidence = theme.seedKeywords.map((seed) => {
      const seedTokens = new Set(canonicalTokens(seed));
      const intersection = [...keywordTokens].filter((token) => seedTokens.has(token)).length;
      return {
        shared: intersection,
        overlap: intersection / Math.max(1, Math.min(keywordTokens.size, seedTokens.size)),
      };
    }).sort((left, right) => right.overlap - left.overlap || right.shared - left.shared)[0] ?? { shared: 0, overlap: 0 };
    const evidenceBacked = (requiredMatches > 0 && seedEvidence.overlap >= 0.25)
      || (seedEvidence.shared >= 2 && seedEvidence.overlap >= 0.6);
    if (!evidenceBacked) continue;
    const score = requiredMatches * 3 + seedEvidence.overlap * 2 + Math.min(0.75, seedEvidence.shared * 0.15);
    if (!best || score > best.score) best = { theme, score };
  }
  return best;
}

export function rankKeywordOpportunities<T extends KeywordCandidate>(
  candidates: T[],
  context: KeywordBusinessContext,
  limit = 50,
  brief?: BusinessSearchBrief,
): Array<RankedKeywordOpportunity<T>> {
  const business = contextProfile(context);
  const businessDescription = business.description;
  const serviceBusiness = SERVICE_BUSINESS.test(businessDescription);
  const businessOffersSoftware = SOFTWARE_PRODUCT.test(businessDescription);
  const seen = new Set<string>();
  const ranked = candidates.flatMap((candidate) => {
    const identity = canonicalTokens(candidate.keyword).join(" ");
    if (!identity || seen.has(identity) || isNoise(candidate.keyword)) return [];
    if (serviceBusiness && !businessOffersSoftware && SOFTWARE_PRODUCT.test(candidate.keyword)) return [];
    if (audienceConflict(candidate.keyword, businessDescription)) return [];
    seen.add(identity);
    if (Number(candidate.rank ?? 0) === 0 && context.pageText && keywordHasGeographicConflict(candidate.keyword, context.pageText)) return [];
    const providerIntent = inferIntent(candidate);
    if (INSTITUTION.test(candidate.keyword) && !INSTITUTION_RESEARCH.test(candidate.keyword)
      && !SERVICE_BUSINESS.test(candidate.keyword) && !BUYER_ACTION.test(candidate.keyword)) return [];
    const keywordTokens = new Set(canonicalTokens(candidate.keyword));
    const offerOverlap = [...keywordTokens].filter((token) => business.offer.has(token)).length;
    const totalOverlap = [...keywordTokens].filter((token) => business.all.has(token)).length;
    const distinctiveOfferOverlap = [...keywordTokens].filter((token) => business.offer.has(token) && !GENERIC_OFFER_TOKENS.has(token)).length;
    const distinctiveTotalOverlap = [...keywordTokens].filter((token) => business.all.has(token) && !GENERIC_OFFER_TOKENS.has(token)).length;
    const themeMatch = brief ? keywordThemeMatch(candidate.keyword, brief) : null;
    const contextualSchoolResearch = HIGH_SCHOOL_AUDIENCE.test(businessDescription)
      && INSTITUTION.test(candidate.keyword)
      && INSTITUTION_RESEARCH.test(candidate.keyword);
    if (brief && !themeMatch && !contextualSchoolResearch) return [];
    const verifiedSchoolResearch = HIGH_SCHOOL_AUDIENCE.test(businessDescription)
      && SCHOOL_RESEARCH_WITHOUT_INSTITUTION_SUFFIX.test(candidate.keyword)
      && Number(candidate.directCompetitorRankers ?? 0) > 0;
    if (business.all.size && totalOverlap === 0 && !verifiedSchoolResearch) return [];
    const hasServiceTerm = SERVICE_BUSINESS.test(candidate.keyword);
    const hasBuyerAction = BUYER_ACTION.test(candidate.keyword);
    const isUsefulInstitutionResearch = INSTITUTION.test(candidate.keyword) && INSTITUTION_RESEARCH.test(candidate.keyword);
    const tokenCoreMatch = serviceBusiness
      ? (hasServiceTerm && (distinctiveOfferOverlap >= 1 || (offerOverlap >= 1 && distinctiveTotalOverlap >= 1)))
        || (hasBuyerAction && distinctiveOfferOverlap >= 1)
      : (offerOverlap >= 2 && distinctiveOfferOverlap >= 1) || (distinctiveOfferOverlap >= 1 && hasBuyerAction);
    const coreMatch = themeMatch
      ? themeMatch.theme.priority === "primary" && (themeMatch.score >= 3.9 || tokenCoreMatch)
      : tokenCoreMatch;
    const relevanceTier: "core" | "adjacent" | null = coreMatch
      ? "core"
      : themeMatch || verifiedSchoolResearch || contextualSchoolResearch || (totalOverlap >= 2 && distinctiveTotalOverlap >= 1) || (distinctiveOfferOverlap >= 1 && (providerIntent === "informational" || isUsefulInstitutionResearch))
        ? "adjacent"
        : null;
    if (!relevanceTier) return [];
    const semanticFit = themeMatch
      ? ({ primary: 0.72, secondary: 0.64, supporting: 0.56 }[themeMatch.theme.priority]
        + Math.min(0.18, (themeMatch.score - 4) * 0.04))
      : 0;
    const businessFit = relevanceTier === "core"
      ? Math.min(1, Math.max(semanticFit, 0.65 + offerOverlap * 0.12 + totalOverlap * 0.05))
      : Math.min(0.78, Math.max(semanticFit, 0.35 + offerOverlap * 0.08 + totalOverlap * 0.1));
    const keywordRevenueFit = revenueFit(candidate.keyword, providerIntent);
    const keywordPriorityTier = priorityTier(relevanceTier, keywordRevenueFit);
    const volume = Math.max(0, Number(candidate.searchVolume ?? 0));
    const difficulty = Math.min(100, Math.max(0, Number(candidate.difficulty ?? 0)));
    const cpc = Math.max(0, Number(candidate.cpc ?? 0));
    const volumePoints = Math.min(10, 10 * Math.log10(volume + 1) / 4.5);
    const attainabilityPoints = Math.max(0, 5 * (1 - difficulty / 100));
    const valuePoints = Math.min(5, 5 * Math.log10(cpc + 1) / 1.7);
    const demandPenalty = volume === 0 ? 6 : volume < 20 && providerIntent !== "transactional" ? 3 : 0;
    const priorityScore = Math.round(Math.max(0, Math.min(100,
      intentPoints(providerIntent) + businessFit * 30 + keywordRevenueFit * 20
      + volumePoints + attainabilityPoints + valuePoints + opportunityPoints(candidate) - demandPenalty,
    )));
    return [{
      ...candidate,
      providerIntent,
      searchIntent: customerIntent(providerIntent),
      businessFit: Math.round(businessFit * 100) / 100,
      revenueFit: Math.round(keywordRevenueFit * 100) / 100,
      relevanceTier,
      priorityTier: keywordPriorityTier,
      priorityScore,
      priorityReason: priorityReason(candidate, providerIntent, relevanceTier, themeMatch?.theme.label),
      // A new brief match always wins. Without one, preserve any valid persisted
      // theme so downstream filters (e.g. offer-fit in editorial calendar) can
      // distinguish an audience segment from a sold service.
      themeId: themeMatch?.theme.id ?? (typeof candidate.themeId === "string" && candidate.themeId ? candidate.themeId : "evidence-based"),
      themeLabel: themeMatch?.theme.label ?? (typeof candidate.themeLabel === "string" && candidate.themeLabel ? candidate.themeLabel : "Evidence-based opportunity"),
      themeRole: themeMatch?.theme.funnelRole ?? (VALID_THEME_ROLES.has(candidate.themeRole as string) ? candidate.themeRole as KeywordTheme["funnelRole"] : (providerIntent === "transactional" ? "conversion" : customerIntent(providerIntent))),
    } as RankedKeywordOpportunity<T>];
  });
  return ranked.sort((left, right) => left.priorityTier - right.priorityTier
    || right.priorityScore - left.priorityScore
    || right.businessFit - left.businessFit
    || Number(right.searchVolume ?? 0) - Number(left.searchVolume ?? 0)
    || left.keyword.localeCompare(right.keyword)).slice(0, Math.max(0, limit));
}

function nearDuplicate(left: string, right: string) {
  const leftTokens = new Set(canonicalTokens(left));
  const rightTokens = new Set(canonicalTokens(right));
  if (!leftTokens.size || !rightTokens.size) return false;
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return intersection / Math.max(1, union) >= 0.78;
}

export function selectDiversifiedKeywordOpportunities<T extends RankedKeywordOpportunity>(ranked: T[], limit = 50): T[] {
  const maximum = Math.max(0, limit);
  if (!maximum) return [];
  const themeCap = Math.max(3, Math.ceil(maximum * 0.3));
  const queues = new Map<string, T[]>();
  for (const keyword of ranked) {
    const queue = queues.get(keyword.themeId) ?? [];
    queue.push(keyword);
    queues.set(keyword.themeId, queue);
  }
  const selected: T[] = [];
  const counts = new Map<string, number>();
  const intentBand = (keyword: T) => keyword.themeRole === "technical_authority"
    ? "technical_authority"
    : keyword.searchIntent === "awareness" ? "awareness" : "commercial";
  const bandCounts = new Map<string, number>();
  const canAdd = (keyword: T) => (counts.get(keyword.themeId) ?? 0) < themeCap
    && !selected.some((existing) => nearDuplicate(existing.keyword, keyword.keyword));
  const add = (keyword: T) => {
    selected.push(keyword);
    counts.set(keyword.themeId, (counts.get(keyword.themeId) ?? 0) + 1);
    const band = intentBand(keyword);
    bandCounts.set(band, (bandCounts.get(band) ?? 0) + 1);
  };

  // Establish real coverage first: the highest-ranked valid opportunity from
  // every evidence-backed theme gets a chance before any theme can dominate.
  for (const queue of queues.values()) {
    let keyword = queue.shift();
    while (keyword && !canAdd(keyword)) keyword = queue.shift();
    if (keyword) add(keyword);
    if (selected.length === maximum) return selected;
  }

  // Preserve Jose's revenue priority while deliberately reserving space for
  // learning-demand and technical-authority paths. Empty bands are never
  // padded; their unused capacity is released to the final global fill.
  const bandTargets: Array<[string, number]> = [
    ["commercial", Math.floor(maximum * 0.44)],
    ["awareness", Math.floor(maximum * 0.26)],
    ["technical_authority", Math.floor(maximum * 0.16)],
  ];
  for (const [band, target] of bandTargets) {
    let madeProgress = true;
    while ((bandCounts.get(band) ?? 0) < target && madeProgress && selected.length < maximum) {
      madeProgress = false;
      for (const queue of queues.values()) {
        const index = queue.findIndex((keyword) => intentBand(keyword) === band && canAdd(keyword));
        if (index < 0) continue;
        const [keyword] = queue.splice(index, 1);
        if (!keyword) continue;
        add(keyword);
        madeProgress = true;
        if ((bandCounts.get(band) ?? 0) >= target || selected.length === maximum) break;
      }
    }
  }

  while (selected.length < maximum && [...queues.values()].some((queue) => queue.length)) {
    let added = false;
    for (const queue of queues.values()) {
      while (queue.length) {
        const keyword = queue.shift();
        if (!keyword || !canAdd(keyword)) continue;
        add(keyword);
        added = true;
        break;
      }
      if (selected.length === maximum) break;
    }
    if (!added) break;
  }
  return selected.sort((left, right) => left.priorityTier - right.priorityTier
    || right.priorityScore - left.priorityScore
    || Number(right.searchVolume ?? 0) - Number(left.searchVolume ?? 0)
    || left.keyword.localeCompare(right.keyword));
}
