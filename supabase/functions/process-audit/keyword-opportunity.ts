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
  locationEvidence?: string;
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
  clutter: "junk", debris: "junk", rubbish: "junk", trash: "junk", waste: "junk",
};

const TRANSACTIONAL = /\b(?:book|buy|call|cost|coupon|discount|fees?|for sale|hire|near me|order|price|prices|pricing|promo code|quote|schedule|sign up|subscribe)\b/i;
const COMMERCIAL = /\b(?:affordable|alternative|alternatives|best|cheap|coach|coaches|coaching|compare|comparison|consultant|consultants|consulting|counseling|counselor|counselors|reviews?|services?|top|versus|vs\.?)\b/i;
const INFORMATIONAL = /^(?:how|what|when|where|why|guide|tips?|examples?|ideas?|checklist)\b/i;
const NOISE = /\b(?:careers?|jobs?|login|password|portal|sign in|torrent|download free)\b/i;
const SERVICE_BUSINESS = /\b(?:agency|coach|coaching|consultant|consulting|counseling|counselor|guidance|service|services)\b/i;
const SOFTWARE_PRODUCT = /\b(?:app|apps|crm|platform|saas|software|system|tool|tools)\b/i;
const BUYER_ACTION = /\b(?:book|buy|call|companies|company|consultation|cost|fees?|hire|near me|price|prices|pricing|quote|reviews?|schedule|sign up)\b/i;
const COMPARISON_ACTION = /\b(?:alternative|alternatives|best|compare|comparison|reviews?|top|versus|vs\.?)\b/i;
const INSTITUTION = /\b(?:academy|colleges?|school|universit(?:y|ies))\b/i;
const INSTITUTION_RESEARCH = /\b(?:acceptance rate|admissions?|application|best|deadline|essay|get into|requirements?|ranking|top|tuition)\b/i;
const SCHOOL_RESEARCH_WITHOUT_INSTITUTION_SUFFIX = /\b(?:acceptance rate|admissions? requirements?|how to get into)\b/i;
const PROOF_OR_SENTENCE_FRAGMENT = /\b(?:customers? need|earned|five[ -]star|served)\b/i;
const RECURRING_COLLECTION_QUERY = /\b(?:interstate waste services?|pick up rubbish services?|rubbish collection services?|rubbish pickup|trash pickup(?: services?)?|trash services?|waste collection services?|waste management residential services?|waste pickup|bulk pickup trash|garbage waste pickup|curbside pickup waste management)\b/i;
const RENTAL_SERVICE_QUERY = /\b(?:dumpster|truck) rentals?\b/i;
const TRUCK_EQUIPMENT_QUERY = /\b(?:disposal|dump|garbage|waste) trucks?\b/i;
const SERVICE_ACTION_QUERY = /\b(?:agency|cleanouts?|coach|coaches|coaching|consultant|consultants|consulting|counseling|counselor|counselors|disposal|haul|hauling|management|pickup|removal|services?)\b/i;
const GRADUATE_AUDIENCE = /\b(?:business school|graduate school|law school|mba|medical school|phd)\b/i;
const HIGH_SCHOOL_AUDIENCE = /\b(?:high school|teen|undergraduate)\b/i;
const GENERIC_OFFER_TOKENS = new Set(["advice", "application", "guidance", "management", "planning", "solution", "strategy", "support"]);
const GENERIC_OFFER_ANCHORS = new Set(["company", "estimate", "free", "local", "pickup", "provider", "removal"]);
const KNOWN_LOCATION_PHRASES = [
  "albuquerque", "anaheim", "anchorage", "arlington", "athens", "atlanta", "austin", "bakersfield", "baltimore", "barrie", "boston",
  "buffalo", "chandler", "charlotte", "chicago", "chula vista", "cincinnati", "cleveland", "columbus", "corpus christi",
  "dallas", "denver", "detroit", "durham", "fort worth", "garland", "gilbert", "glendale", "green bay", "greensboro",
  "henderson", "hialeah", "honolulu", "houston", "indianapolis", "irvine", "jacksonville", "jersey city", "kansas city",
  "las vegas", "lexington", "long beach", "los angeles", "louisville", "madison", "manhattan", "memphis", "mesa", "miami",
  "milwaukee", "minneapolis", "nashville", "new orleans", "new york", "new york city", "newark", "norfolk", "north las vegas", "nyc",
  "oklahoma city", "omaha", "orlando", "ottawa", "philadelphia", "phoenix", "pittsburgh", "plano", "portland", "raleigh", "reno", "riverside",
  "roswell", "saint louis", "san antonio", "san diego", "santa ana", "scottsdale", "seattle", "st louis", "stockton",
  "tampa", "tucson", "tulsa", "virginia beach", "washington dc", "wichita", "winston salem", "york pa",
  "berkeley", "fremont", "livermore", "los altos", "los gatos", "menlo park", "mill valley", "mountain view",
  "oakland", "palo alto", "pleasanton", "redwood city", "sacramento", "san carlos", "san francisco", "san jose",
  "san mateo", "san ramon", "santa clara", "south san francisco", "walnut creek",
] as const;
const OFFER_CONTEXT_ONLY_TOKENS = new Set([
  ...GENERIC_OFFER_TOKENS,
  ...GENERIC_OFFER_ANCHORS,
  ...KNOWN_LOCATION_PHRASES.flatMap((place) => place.split(/\s+/)),
  "area", "bay", "california", "ca", "commercial", "day", "fast", "home", "me", "near", "residential", "same", "usa", "united", "states",
]);
const GENERIC_DIFFERENTIATOR_TOKENS = new Set([
  ...OFFER_CONTEXT_ONLY_TOKENS,
  "estimate", "experience", "review", "team", "year",
]);
const DISCOVERY_MODIFIER_TOKENS = new Set([
  "affordable", "best", "cheap", "company", "cost", "day", "estimate", "fast", "free", "guide", "hire", "how", "list", "listing", "local", "near", "post", "pre", "price", "pricing", "quote", "review", "same", "top", "what", "when", "where", "why",
]);

function normalizedPhrase(value: string) {
  return ` ${value.normalize("NFKC").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
}

export function keywordHasGeographicConflict(
  candidate: Pick<KeywordCandidate, "keyword" | "opportunity">,
  context: KeywordBusinessContext,
) {
  if (candidate.opportunity === "existing_rank") return false;
  const keyword = normalizedPhrase(candidate.keyword);
  const evidence = normalizedPhrase([
    context.productsServices,
    context.problemSolved,
    context.idealCustomer,
    context.audienceChallengesGoals,
    context.differentiation,
    context.locationEvidence,
  ].filter(Boolean).join(" "));
  return KNOWN_LOCATION_PHRASES.some((place) => keyword.includes(` ${place} `) && !evidence.includes(` ${place} `));
}

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
    context.locationEvidence,
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

function isLowEvidenceSiteIdea(candidate: KeywordCandidate, businessTokens: Set<string>) {
  if (candidate.opportunity !== "site_idea") return false;
  if (SCHOOL_RESEARCH_WITHOUT_INSTITUTION_SUFFIX.test(candidate.keyword)) return false;
  const tokens = canonicalTokens(candidate.keyword);
  const counts = tokens.reduce<Map<string, number>>((result, token) =>
    result.set(token, (result.get(token) ?? 0) + 1), new Map());
  if ([...counts].some(([token, count]) => count > 1 && !OFFER_CONTEXT_ONLY_TOKENS.has(token))) return true;
  const meaningful = tokens.filter((token) => !DISCOVERY_MODIFIER_TOKENS.has(token));
  if (meaningful.length < 2 || businessTokens.has(meaningful[0])) return false;
  const grounded = meaningful.filter((token) => businessTokens.has(token)).length;
  return grounded / meaningful.length <= 0.5;
}

function hasContextualSemanticConflict(candidate: KeywordCandidate, businessDescription: string, businessTokens: Set<string>) {
  if (candidate.opportunity !== "site_idea") return false;
  const keyword = candidate.keyword;
  const admissionsBusiness = /\b(?:college|admissions?|application)\b/i.test(businessDescription);
  if (admissionsBusiness && /\b(?:essay|coaching?)\b/i.test(keyword)) {
    const exactCoreService = /^\s*essay coaching\s*$/i.test(keyword);
    const admissionsAnchor = /\b(?:college|admissions?|application|student|high school)\b/i.test(keyword);
    if (!exactCoreService && !admissionsAnchor) return true;
  }

  const removalBusiness = /\b(?:junk|furniture|appliance|debris).*(?:cleanout|haul|removal)\b/i.test(businessDescription);
  if (!removalBusiness || !/\b(?:cleanout|haul|removal)\b/i.test(keyword)) return false;
  const meaningful = canonicalTokens(keyword).filter((token) => !DISCOVERY_MODIFIER_TOKENS.has(token));
  const unknownIndexes = meaningful.flatMap((token, index) => businessTokens.has(token) ? [] : [index]);
  if (unknownIndexes.length !== 1) return false;
  const [unknownIndex] = unknownIndexes;
  return unknownIndex === 0 || (unknownIndex > 0 && unknownIndex < meaningful.length - 1);
}

function inferIntent(candidate: KeywordCandidate): ProviderIntent {
  if (TRANSACTIONAL.test(candidate.keyword)) return "transactional";
  // Provider intent can mislabel institution-research queries as commercial.
  // These are awareness topics unless the phrase also expresses a buyer action.
  if (INSTITUTION.test(candidate.keyword) && INSTITUTION_RESEARCH.test(candidate.keyword)
    && !SERVICE_BUSINESS.test(candidate.keyword) && !BUYER_ACTION.test(candidate.keyword)) return "informational";
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
  return ({ transactional: 25, commercial: 21, navigational: 6, informational: 8 }[intent]);
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

function keywordConflictsWithNonOffer(keyword: string, brief: BusinessSearchBrief) {
  const keywordTokens = new Set(canonicalTokens(keyword));
  return brief.offerVsEnablement.notTheOffer.some((phrase) => {
    const terms = canonicalTokens(phrase);
    if (!terms.length) return false;
    const shared = terms.filter((term) => keywordTokens.has(term)).length;
    return shared === terms.length || (terms.length >= 2 && shared >= 2);
  });
}

function keywordHasOfferAnchor(keyword: string, brief: BusinessSearchBrief) {
  const keywordTokens = new Set(canonicalTokens(keyword));
  if (!keywordTokens.size) return false;
  const offerPhrases = [
    ...brief.offerVsEnablement.whatCompanySells,
    ...brief.themes
      .filter((theme) => theme.evidence.some((item) => item.field === "productsServices"))
      .flatMap((theme) => [...theme.requiredTerms, ...theme.seedKeywords]),
  ];
  return offerPhrases.some((phrase) => {
    const phraseTerms = canonicalTokens(phrase);
    const meaningfulTerms = phraseTerms.filter((term) => !OFFER_CONTEXT_ONLY_TOKENS.has(term));
    const shared = meaningfulTerms.filter((term) => keywordTokens.has(term)).length;
    return shared >= 2 || (shared === 1 && SERVICE_ACTION_QUERY.test(keyword));
  });
}

function keywordHasTechnicalAuthorityAnchor(keyword: string, theme: KeywordTheme) {
  if (theme.funnelRole !== "technical_authority") return false;
  const keywordTokens = new Set(canonicalTokens(keyword));
  const evidenceTerms = new Set([...theme.requiredTerms, ...theme.seedKeywords]
    .flatMap(canonicalTokens)
    .filter((term) => !GENERIC_DIFFERENTIATOR_TOKENS.has(term)));
  return [...evidenceTerms].filter((term) => keywordTokens.has(term)).length >= 2;
}

function themeRequiresOfferAnchor(theme: KeywordTheme, keyword: string, intent: ProviderIntent) {
  const fields = new Set(theme.evidence.map((item) => item.field));
  if (fields.has("productsServices")) return true;
  if (fields.has("idealCustomer") || fields.has("market") || fields.has("differentiation")) return true;
  if (!fields.has("problemSolved") && !fields.has("audienceChallengesGoals")) return false;
  // A real long-tail problem query can be useful awareness content even when
  // it does not name the solution. Short outcome fragments and buyer queries
  // must still name the offer they are meant to sell.
  return intent !== "informational" || canonicalTokens(keyword).length < 4;
}

function isBroadInformationalHeadTerm(candidate: KeywordCandidate, intent: ProviderIntent) {
  if (intent !== "informational" || candidate.opportunity === "existing_rank") return false;
  const tokens = canonicalTokens(candidate.keyword);
  return tokens.length <= 2 && !TRANSACTIONAL.test(candidate.keyword) && !COMMERCIAL.test(candidate.keyword)
    && !INFORMATIONAL.test(candidate.keyword);
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
    const volume = Number(candidate.searchVolume);
    // Recommendations must be backed by a positive DataForSEO demand record.
    // Raw onboarding phrases can be useful as expansion queries, never as
    // recommendable keywords in their own right.
    if (!Number.isFinite(volume) || volume <= 0) return [];
    const identity = canonicalTokens(candidate.keyword).join(" ");
    if (!identity || seen.has(identity) || isNoise(candidate.keyword)) return [];
    if (isLowEvidenceSiteIdea(candidate, business.all)) return [];
    if (hasContextualSemanticConflict(candidate, businessDescription, business.all)) return [];
    if (serviceBusiness && !businessOffersSoftware && SOFTWARE_PRODUCT.test(candidate.keyword)) return [];
    const productsServices = context.productsServices ?? "";
    if (RECURRING_COLLECTION_QUERY.test(candidate.keyword)
      && !/\b(?:garbage collection|rubbish collection|trash collection|trash pickup)\b/i.test(productsServices)) return [];
    if (RENTAL_SERVICE_QUERY.test(candidate.keyword) && !RENTAL_SERVICE_QUERY.test(productsServices)) return [];
    if (TRUCK_EQUIPMENT_QUERY.test(candidate.keyword) && !TRUCK_EQUIPMENT_QUERY.test(productsServices)) return [];
    if (brief && keywordConflictsWithNonOffer(candidate.keyword, brief)) return [];
    if (/\b(?:auto|car|cars|vehicle|vehicles)\b/i.test(candidate.keyword)
      && !/\b(?:auto|car|cars|vehicle|vehicles)\b/i.test(productsServices)) return [];
    if (/\bleads?\b/i.test(candidate.keyword) && !/\bleads?\b/i.test(productsServices)) return [];
    if (audienceConflict(candidate.keyword, businessDescription)) return [];
    if (keywordHasGeographicConflict(candidate, context)) return [];
    seen.add(identity);
    const providerIntent = inferIntent(candidate);
    if (isBroadInformationalHeadTerm(candidate, providerIntent)) return [];
    if (INSTITUTION.test(candidate.keyword) && !INSTITUTION_RESEARCH.test(candidate.keyword)
      && !SERVICE_BUSINESS.test(candidate.keyword) && !BUYER_ACTION.test(candidate.keyword)) return [];
    const keywordTokens = new Set(canonicalTokens(candidate.keyword));
    const offerOverlap = [...keywordTokens].filter((token) => business.offer.has(token)).length;
    const totalOverlap = [...keywordTokens].filter((token) => business.all.has(token)).length;
    const distinctiveOfferOverlap = [...keywordTokens].filter((token) => business.offer.has(token) && !GENERIC_OFFER_TOKENS.has(token)).length;
    const distinctiveTotalOverlap = [...keywordTokens].filter((token) => business.all.has(token) && !GENERIC_OFFER_TOKENS.has(token)).length;
    if (PROOF_OR_SENTENCE_FRAGMENT.test(candidate.keyword) && distinctiveOfferOverlap < 2) return [];
    const savedAudienceTheme = /(?:audience|customer outcome|market relevance)/i
      .test(`${String(candidate.themeId ?? "")} ${String(candidate.themeLabel ?? "")}`);
    if (!brief && savedAudienceTheme && distinctiveOfferOverlap < 2) return [];
    const themeMatch = brief ? keywordThemeMatch(candidate.keyword, brief) : null;
    if (brief && themeMatch && themeRequiresOfferAnchor(themeMatch.theme, candidate.keyword, providerIntent)
      && !keywordHasOfferAnchor(candidate.keyword, brief)
      && !keywordHasTechnicalAuthorityAnchor(candidate.keyword, themeMatch.theme)) return [];
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
    const difficulty = Math.min(100, Math.max(0, Number(candidate.difficulty ?? 0)));
    const cpc = Math.max(0, Number(candidate.cpc ?? 0));
    const volumePoints = Math.round(Math.min(10, 10 * Math.log10(volume + 1) / 4.5));
    const attainabilityPoints = Math.round(Math.max(0, 5 * (1 - difficulty / 100)));
    const valuePoints = Math.round(Math.min(5, 5 * Math.log10(cpc + 1) / 1.7));
    const demandPenalty = volume < 20 && providerIntent !== "transactional" ? 3 : 0;
    const savedThemeRole = ["conversion", "consideration", "awareness", "technical_authority"].includes(String(candidate.themeRole))
      ? candidate.themeRole as KeywordTheme["funnelRole"]
      : null;
    const priorityScore = Math.max(0, Math.min(100,
      intentPoints(providerIntent) + Math.round(businessFit * 30) + Math.round(keywordRevenueFit * 20)
      + volumePoints + attainabilityPoints + valuePoints + opportunityPoints(candidate) - demandPenalty,
    ));
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
      themeId: themeMatch?.theme.id ?? (typeof candidate.themeId === "string" ? candidate.themeId : "evidence-based"),
      themeLabel: themeMatch?.theme.label ?? (typeof candidate.themeLabel === "string" ? candidate.themeLabel : "Evidence-based opportunity"),
      themeRole: themeMatch?.theme.funnelRole ?? savedThemeRole ?? (providerIntent === "transactional" ? "conversion" : customerIntent(providerIntent)),
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
  const queues = new Map<string, T[]>();
  for (const keyword of ranked) {
    const queue = queues.get(keyword.themeId) ?? [];
    queue.push(keyword);
    queues.set(keyword.themeId, queue);
  }
  const themeCap = queues.size <= 1 ? maximum : Math.max(3, Math.ceil(maximum * 0.3));
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

  // Preserve revenue priority while deliberately reserving space for
  // learning-demand and technical-authority paths. Empty bands are never
  // padded, and no theme is guaranteed a slot merely for existing.
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
