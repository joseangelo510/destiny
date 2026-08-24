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

export type KeywordQualityRejectionReason =
  | "no_measured_demand"
  | "not_a_search_phrase"
  | "unsupported_business_model"
  | "unsupported_location"
  | "missing_business_evidence"
  | "search_noise";

export type KeywordQualityGateResult = {
  accepted: boolean;
  rejectionReasons: KeywordQualityRejectionReason[];
};

export type ProviderIntent = "transactional" | "commercial" | "navigational" | "informational";
export type CustomerIntent = "conversion" | "consideration" | "awareness";

export type KeywordPreferenceSignal = {
  normalizedKeyword: string;
  decision: "approved" | "declined";
  reason?: "wrong_audience" | "not_offered" | "too_competitive" | "already_covered" | "not_now" | null;
  updatedAt?: string | null;
};

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
  "a", "about", "and", "are", "as", "at", "be", "best", "business", "by", "customer", "customers", "does", "expert", "for", "from", "get", "good", "help", "high", "how", "in", "into", "is", "it", "local", "of", "on", "online", "or", "our", "people", "private", "provide", "service", "services", "that", "the", "their", "them", "they", "this", "to", "top", "want", "was", "we", "what", "when", "where", "who", "why", "with", "you", "your",
]);

const TOKEN_FAMILIES: Record<string, string> = {
  acting: "acting",
  authenticate: "authenticity", authenticated: "authenticity", authentication: "authenticity", authenticity: "authenticity",
  certificate: "certify", certificates: "certify", certification: "certify", certifications: "certify", certified: "certify", certify: "certify",
  check: "check", checked: "check", checker: "check", checkers: "check", checking: "check", checks: "check",
  compliance: "compliance", compliant: "compliance", comply: "compliance",
  detect: "detect", detected: "detect", detecting: "detect", detection: "detect", detector: "detect", detectors: "detect",
  disclose: "disclosure", disclosed: "disclosure", disclosing: "disclosure", disclosure: "disclosure", disclosures: "disclosure",
  label: "label", labeled: "label", labeling: "label", labelled: "label", labelling: "label", labels: "label",
  verification: "verify", verified: "verify", verifies: "verify", verify: "verify",
  watermark: "watermark", watermarked: "watermark", watermarking: "watermark", watermarks: "watermark",
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
const COMMERCIAL = /\b(?:affordable|agency|alternative|alternatives|best|cheap|coach|coaches|coaching|compare|comparison|consultant|consultants|consulting|counseling|counselor|counselors|expert|experts|reviews?|services?|top|versus|vs\.?)\b/i;
const INFORMATIONAL = /^(?:how|what|when|where|why|guide|tips?|examples?|ideas?|checklist)\b/i;
const NOISE = /\b(?:careers?|jobs?|login|password|portal|sign in|torrent|download free)\b/i;
const PHYSICS_QUERY = /\bspeed of light\b/i;
const LLM_BUSINESS = /\b(?:ai agents?|large language models?|llm|multiagent)\b/i;
const LLM_KEYWORD_ANCHOR = /\b(?:ai|agents?|inference|llm|models?|tokens?)\b/i;
const OBSERVABILITY_QUERY = /\bobservability\b/i;
const OBSERVABILITY_COMPARISON = /\b(?:alternative|alternatives|compare|comparison|optimization|versus|vs\.?)\b/i;
const LLM_ACADEMIC_NOISE = /\b(?:college|columbia|course|degree|harvard|lse|masters?|nyu|phd|program|stanford|students?|university|yale)\b/i;
const LLM_ACADEMIC_LOCATION_COST = /\b(?:cost of llm in|llm cost in|llm in)\s+(?:australia|canada|india|ireland|new zealand|usa|united states)\b/i;
const SERVICE_PROVIDER_QUERY = /\b(?:agency|consultants?|consulting|experts?|services?)\b/i;
const LLM_VISIBILITY_QUERY = /(?:\bseo\b|\bsearch engine optimization\b|\bllm search optimization\b|\bcontent optimization\b)/i;
const LLM_RESEARCH_PAPER_NOISE = /\b(?:reset replay|sample efficient|survey and roofline)\b/i;
const LLM_TRAINING_QUERY = /\b(?:fine[- ]?tuning|training)\b/i;
const LLM_ENGINE_OPTIMIZATION = /\bllm engine optimization\b/i;
const AI_MEDIA_COMPLIANCE_BUSINESS = /\bai\b[\s\S]{0,120}\b(?:compliance|detect|disclos|label|transparen)|\b(?:compliance|detect|disclos|label|transparen)[\s\S]{0,120}\bai\b/i;
const NON_MEDIA_AI_CHECK_QUERY = /\b(?:code|documents?|essays?|pdf|texts?|turnitin|words?)\b/i;
const AI_MEDIA_CREATION_TANGENT = /\b(?:copyright(?:ed)?|cursed|funny|of myself|to video)\b/i;
const BRANDED_AI_CHECK_QUERY = /\b(?:content at scale|grammarly|truthscan|turnitin)\b/i;
const REDUNDANT_AI_CHECK_QUERY = /\bai\b.*\b(?:detectors?.*checkers?|checkers?.*detectors?)\b/i;
const XMP_SOFTWARE_NOISE = /\b(?:enable clip|read xmp metadata|contained no settings)\b/i;
const ACADEMIC_SURVEY_NOISE = /\b(?:sok|systemati[sz]ation of knowledge)\b/i;
const SERVICE_BUSINESS = /\b(?:agency|coach|coaching|consultant|consulting|counseling|counselor|guidance|service|services)\b/i;
const SOFTWARE_PRODUCT = /\b(?:app|apps|crm|platform|saas|software|system|tool|tools)\b/i;
const BUYER_ACTION = /\b(?:book|buy|call|companies|company|consultation|cost|fees?|hire|near me|price|prices|pricing|quote|reviews?|schedule|sign up)\b/i;
const COMPARISON_ACTION = /\b(?:alternative|alternatives|best|compare|comparison|reviews?|top|versus|vs\.?)\b/i;
const INSTITUTION = /\b(?:academy|colleges?|school|universit(?:y|ies))\b/i;
const INSTITUTION_RESEARCH = /\b(?:acceptance rate|admissions?|application|best|deadline|essay|get into|requirements?|ranking|top|tuition)\b/i;
const SCHOOL_RESEARCH_WITHOUT_INSTITUTION_SUFFIX = /\b(?:acceptance rate|admissions? requirements?|how to get into)\b/i;
const PROOF_OR_SENTENCE_FRAGMENT = /\b(?:customers? need|earned|five[ -]star|served)\b/i;
const COPIED_BUSINESS_LANGUAGE = /(?:^\s*(?:serve|serving)\b|\b\d+\s*(?:five[ -]star|5[ -]star|star)\s+reviews?\b)/i;
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
  "affordable", "best", "better", "cheap", "cheaper", "cost", "costs", "estimate", "experience", "free", "good", "great",
  "high", "low", "lower", "lowest", "price", "prices", "pricing", "quality", "quick", "reliable", "review", "team", "top",
  "trusted", "trustworthy", "value", "year",
]);
const DISCOVERY_MODIFIER_TOKENS = new Set([
  "affordable", "best", "cheap", "company", "cost", "day", "does", "estimate", "fast", "free", "guide", "hire", "how", "list", "listing", "local", "much", "near", "post", "pre", "price", "pricing", "quote", "review", "run", "same", "top", "what", "when", "where", "why",
]);
const WEAK_DOMAIN_EVIDENCE_TOKENS = new Set([
  "ai", "agent", "brand", "builder", "content", "create", "created", "face", "free", "general", "google", "human", "image", "legal", "market", "meta", "model", "read", "scale", "score", "stand", "tool", "use", "video", "website", "work",
]);
const STRONG_EVIDENCE_IGNORED_TOKENS = new Set([
  ...OFFER_CONTEXT_ONLY_TOKENS,
  ...DISCOVERY_MODIFIER_TOKENS,
  ...WEAK_DOMAIN_EVIDENCE_TOKENS,
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
  return value.normalize("NFKC").toLowerCase().replace(/\bartificial intelligence\b/g, "ai").replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/)
    .filter((token) => (token === "ai" || token.length >= 3) && !STOP_WORDS.has(token) && !/^\d+$/.test(token))
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

function contextIsServiceBusiness(context: KeywordBusinessContext, description: string) {
  return SERVICE_BUSINESS.test(description)
    || SERVICE_ACTION_QUERY.test(context.productsServices ?? "");
}

function isNoise(keyword: string) {
  const normalized = keyword.trim();
  if (!normalized || NOISE.test(normalized)) return true;
  const tokens = normalized.match(/[a-z]+|\d+/gi) ?? [];
  const numeric = tokens.filter((token) => /^\d+$/.test(token)).length;
  return numeric >= 2 && numeric / Math.max(tokens.length, 1) >= 0.4;
}

/**
 * A small, deterministic admission gate for owner-facing keyword ideas.
 *
 * This deliberately runs before scoring. Provider rows and onboarding prose
 * are research inputs; they are not recommendations until they describe a
 * measured search, fit the business model, and pass the basic phrase checks.
 */
export function keywordQualityGate(
  candidate: KeywordCandidate,
  context: KeywordBusinessContext,
): KeywordQualityGateResult {
  const volume = Number(candidate.searchVolume);
  if (!Number.isFinite(volume) || volume <= 0) {
    return { accepted: false, rejectionReasons: ["no_measured_demand"] };
  }

  const keyword = String(candidate.keyword ?? "").normalize("NFKC").trim();
  const tokens = keyword.match(/[a-z]+|\d+/gi) ?? [];
  if (
    tokens.length < 2
    || PROOF_OR_SENTENCE_FRAGMENT.test(keyword)
    || COPIED_BUSINESS_LANGUAGE.test(keyword)
  ) {
    return { accepted: false, rejectionReasons: ["not_a_search_phrase"] };
  }

  if (isNoise(keyword)) {
    return { accepted: false, rejectionReasons: ["search_noise"] };
  }

  const business = contextProfile(context);
  const serviceBusiness = contextIsServiceBusiness(context, business.description);
  const businessOffersSoftware = SOFTWARE_PRODUCT.test(business.description);
  if (
    (serviceBusiness && !businessOffersSoftware && SOFTWARE_PRODUCT.test(keyword))
    || (businessOffersSoftware && !serviceBusiness && SERVICE_PROVIDER_QUERY.test(keyword))
  ) {
    return { accepted: false, rejectionReasons: ["unsupported_business_model"] };
  }

  if (keywordHasGeographicConflict(candidate, context)) {
    return { accepted: false, rejectionReasons: ["unsupported_location"] };
  }

  return { accepted: true, rejectionReasons: [] };
}

function isLowEvidenceSiteIdea(candidate: KeywordCandidate, businessTokens: Set<string>) {
  if (candidate.opportunity !== "site_idea") return false;
  if (SCHOOL_RESEARCH_WITHOUT_INSTITUTION_SUFFIX.test(candidate.keyword)) return false;
  const tokens = canonicalTokens(candidate.keyword);
  const counts = tokens.reduce<Map<string, number>>((result, token) =>
    result.set(token, (result.get(token) ?? 0) + 1), new Map());
  if ([...counts].some(([token, count]) => count > 1 && !OFFER_CONTEXT_ONLY_TOKENS.has(token))) return true;
  const meaningful = tokens.filter((token) => !DISCOVERY_MODIFIER_TOKENS.has(token));
  const grounded = meaningful.filter((token) => businessTokens.has(token)).length;
  if (!meaningful.length) return true;
  if (grounded === meaningful.length) return false;
  if (meaningful.length < 2) return true;
  if (meaningful.length <= 3) return true;
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
  // A provider may label service-provider phrases as informational. In a
  // strategy product, agency, expert, consultant, and services searches are
  // consideration intent unless the phrase has a stronger buying action.
  if (SERVICE_PROVIDER_QUERY.test(candidate.keyword)) return "commercial";
  const supplied = String(candidate.intent ?? "").toLowerCase();
  if (supplied.includes("transaction") || supplied.includes("conversion")) return "transactional";
  if (supplied.includes("commercial") || supplied.includes("consideration")) return "commercial";
  if (supplied.includes("navigation")) return "navigational";
  if (supplied.includes("information") || supplied.includes("awareness")) return "informational";
  if (COMMERCIAL.test(candidate.keyword)) return "commercial";
  if (INFORMATIONAL.test(candidate.keyword)) return "informational";
  return "informational";
}

function preferenceIdentity(value: string) {
  return canonicalTokens(value).join(" ");
}

function preferenceSimilarity(left: string, right: string) {
  const leftTokens = new Set(canonicalTokens(left));
  const rightTokens = new Set(canonicalTokens(right));
  if (!leftTokens.size || !rightTokens.size) return 0;
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return intersection / new Set([...leftTokens, ...rightTokens]).size;
}

export function applyKeywordPreferenceSignals<T extends RankedKeywordOpportunity>(
  ranked: T[],
  signals: KeywordPreferenceSignal[] = [],
  now = new Date(),
): T[] {
  if (!signals.length) return ranked;
  const activeSignals = signals.flatMap((signal) => {
    const identity = preferenceIdentity(signal.normalizedKeyword);
    if (!identity) return [];
    if (signal.decision === "declined" && signal.reason === "not_now") {
      const updatedAt = Date.parse(signal.updatedAt ?? "");
      if (Number.isFinite(updatedAt) && now.getTime() - updatedAt > 90 * 24 * 60 * 60 * 1000) return [];
    }
    return [{ ...signal, identity }];
  });

  return ranked.flatMap((keyword) => {
    const identity = preferenceIdentity(keyword.keyword);
    const approved = activeSignals.find((signal) => signal.decision === "approved" && signal.identity === identity);
    const declined = activeSignals.find((signal) => signal.decision === "declined" && (
      signal.identity === identity
      || (["wrong_audience", "not_offered"].includes(signal.reason ?? "")
        && preferenceSimilarity(signal.normalizedKeyword, keyword.keyword) >= 0.75)
    ));
    if (declined) return [];
    if (!approved) return [keyword];
    return [{
      ...keyword,
      priorityTier: Math.min(keyword.priorityTier, 2) as 1 | 2,
      priorityScore: Math.min(100, keyword.priorityScore + 12),
      priorityReason: `${keyword.priorityReason} · previously approved`,
    }];
  }).sort((left, right) => left.priorityTier - right.priorityTier
    || right.priorityScore - left.priorityScore
    || Number(right.searchVolume ?? 0) - Number(left.searchVolume ?? 0)
    || left.keyword.localeCompare(right.keyword));
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
    const requiredMatches = theme.requiredTerms.filter((phrase) => {
      const terms = canonicalTokens(phrase);
      return terms.some((term) => !WEAK_DOMAIN_EVIDENCE_TOKENS.has(term)) && phraseMatches(keywordTokens, phrase);
    }).length;
    const seedEvidence = theme.seedKeywords.map((seed) => {
      const seedTokens = new Set(canonicalTokens(seed));
      const intersection = [...keywordTokens].filter((token) => seedTokens.has(token)).length;
      const distinctiveIntersection = [...keywordTokens]
        .filter((token) => seedTokens.has(token) && !WEAK_DOMAIN_EVIDENCE_TOKENS.has(token)).length;
      return {
        shared: intersection,
        distinctiveShared: distinctiveIntersection,
        overlap: intersection / Math.max(1, Math.min(keywordTokens.size, seedTokens.size)),
      };
    }).sort((left, right) => right.overlap - left.overlap || right.distinctiveShared - left.distinctiveShared || right.shared - left.shared)[0]
      ?? { shared: 0, distinctiveShared: 0, overlap: 0 };
    const evidenceBacked = (requiredMatches > 0 && seedEvidence.overlap >= 0.25)
      || (seedEvidence.distinctiveShared >= 1 && seedEvidence.shared >= 2 && seedEvidence.overlap >= 0.6);
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
    return shared === terms.length || (terms.length >= 3 && shared / terms.length >= 0.75);
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
  const serviceBusiness = contextIsServiceBusiness(context, businessDescription);
  const businessOffersSoftware = SOFTWARE_PRODUCT.test(businessDescription);
  const seen = new Set<string>();
  const ranked = candidates.flatMap((candidate) => {
    const quality = keywordQualityGate(candidate, context);
    if (!quality.accepted) return [];
    const volume = Number(candidate.searchVolume);
    const identity = canonicalTokens(candidate.keyword).join(" ");
    if (!identity || seen.has(identity) || isNoise(candidate.keyword)) return [];
    const keywordTokens = new Set(canonicalTokens(candidate.keyword));
    const specificBusinessOverlap = [...keywordTokens]
      .filter((token) => business.all.has(token) && !OFFER_CONTEXT_ONLY_TOKENS.has(token)).length;
    const highSignalBusinessOverlap = [...keywordTokens]
      .filter((token) => business.all.has(token) && !STRONG_EVIDENCE_IGNORED_TOKENS.has(token)).length;
    const hasStrongDomainAnchor = highSignalBusinessOverlap >= 1;
    const themeMatch = brief ? keywordThemeMatch(candidate.keyword, brief) : null;
    const strongThemeMatch = Boolean(themeMatch && themeMatch.score >= 4.5);
    if (isLowEvidenceSiteIdea(candidate, business.all)
      && !(strongThemeMatch && specificBusinessOverlap >= 2)) return [];
    if (PHYSICS_QUERY.test(candidate.keyword) && !/\b(?:physics|photon|optics|light speed)\b/i.test(businessDescription)) return [];
    if (LLM_BUSINESS.test(businessDescription) && candidate.opportunity !== "existing_rank"
      && !LLM_KEYWORD_ANCHOR.test(candidate.keyword)) return [];
    if (LLM_BUSINESS.test(businessDescription)
      && (LLM_ACADEMIC_NOISE.test(candidate.keyword) || LLM_ACADEMIC_LOCATION_COST.test(candidate.keyword))) return [];
    if (LLM_BUSINESS.test(businessDescription) && LLM_VISIBILITY_QUERY.test(candidate.keyword)
      && !/\b(?:ai visibility|search engine optimization|seo)\b/i.test(businessDescription)) return [];
    if (LLM_BUSINESS.test(businessDescription) && LLM_RESEARCH_PAPER_NOISE.test(candidate.keyword)) return [];
    if (LLM_BUSINESS.test(businessDescription) && LLM_TRAINING_QUERY.test(candidate.keyword)
      && !/\b(?:fine[- ]?tuning|training)\b/i.test(businessDescription)) return [];
    if (LLM_BUSINESS.test(businessDescription) && LLM_ENGINE_OPTIMIZATION.test(candidate.keyword)
      && !/\binference engine\b/i.test(businessDescription)) return [];
    if (AI_MEDIA_COMPLIANCE_BUSINESS.test(businessDescription)
      && NON_MEDIA_AI_CHECK_QUERY.test(candidate.keyword)
      && !NON_MEDIA_AI_CHECK_QUERY.test(context.productsServices ?? "")) return [];
    if (AI_MEDIA_COMPLIANCE_BUSINESS.test(businessDescription)
      && AI_MEDIA_CREATION_TANGENT.test(candidate.keyword)
      && !AI_MEDIA_CREATION_TANGENT.test(context.productsServices ?? "")) return [];
    if (AI_MEDIA_COMPLIANCE_BUSINESS.test(businessDescription)
      && (BRANDED_AI_CHECK_QUERY.test(candidate.keyword) || REDUNDANT_AI_CHECK_QUERY.test(candidate.keyword))) return [];
    if (AI_MEDIA_COMPLIANCE_BUSINESS.test(businessDescription)
      && (XMP_SOFTWARE_NOISE.test(candidate.keyword) || ACADEMIC_SURVEY_NOISE.test(candidate.keyword))) return [];
    if (OBSERVABILITY_QUERY.test(candidate.keyword)
      && /\bobservability\b/i.test(context.differentiation ?? "")
      && !OBSERVABILITY_COMPARISON.test(candidate.keyword)) return [];
    if (hasContextualSemanticConflict(candidate, businessDescription, business.all)) return [];
    if (serviceBusiness && !businessOffersSoftware && SOFTWARE_PRODUCT.test(candidate.keyword)) return [];
    if (businessOffersSoftware && !serviceBusiness && SERVICE_PROVIDER_QUERY.test(candidate.keyword)) return [];
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
    if (INSTITUTION.test(candidate.keyword) && !INSTITUTION_RESEARCH.test(candidate.keyword)
      && !SERVICE_BUSINESS.test(candidate.keyword) && !BUYER_ACTION.test(candidate.keyword)) return [];
    const offerOverlap = [...keywordTokens].filter((token) => business.offer.has(token)).length;
    const totalOverlap = [...keywordTokens].filter((token) => business.all.has(token)).length;
    const distinctiveOfferOverlap = [...keywordTokens].filter((token) => business.offer.has(token) && !GENERIC_OFFER_TOKENS.has(token)).length;
    const distinctiveTotalOverlap = [...keywordTokens].filter((token) => business.all.has(token) && !GENERIC_OFFER_TOKENS.has(token)).length;
    const specificOfferOverlap = [...keywordTokens]
      .filter((token) => business.offer.has(token) && !OFFER_CONTEXT_ONLY_TOKENS.has(token)).length;
    const highSignalOfferOverlap = [...keywordTokens]
      .filter((token) => business.offer.has(token)
        && !STRONG_EVIDENCE_IGNORED_TOKENS.has(token)).length;
    const strongOfferEvidence = highSignalOfferOverlap >= 2
      || (specificOfferOverlap >= 1 && specificBusinessOverlap >= 2 && hasStrongDomainAnchor)
      || (highSignalOfferOverlap >= 1 && BUYER_ACTION.test(candidate.keyword));
    const strongBusinessEvidence = specificBusinessOverlap >= 2 && highSignalBusinessOverlap >= 1;
    if (isBroadInformationalHeadTerm(candidate, providerIntent)
      && (SERVICE_ACTION_QUERY.test(candidate.keyword) || !strongOfferEvidence)) return [];
    if (PROOF_OR_SENTENCE_FRAGMENT.test(candidate.keyword) && distinctiveOfferOverlap < 2) return [];
    const savedAudienceTheme = /(?:audience|customer outcome|market relevance)/i
      .test(`${String(candidate.themeId ?? "")} ${String(candidate.themeLabel ?? "")}`);
    if (!brief && savedAudienceTheme && distinctiveOfferOverlap < 2) return [];
    const hasBriefOfferAnchor = brief ? keywordHasOfferAnchor(candidate.keyword, brief) : false;
    const hasSpecificTechnicalAnchor = themeMatch
      ? keywordHasTechnicalAuthorityAnchor(candidate.keyword, themeMatch.theme)
      : false;
    if (brief && themeMatch && themeRequiresOfferAnchor(themeMatch.theme, candidate.keyword, providerIntent)
      && !hasBriefOfferAnchor
      && !hasSpecificTechnicalAnchor
      && !strongOfferEvidence) return [];
    const contextualSchoolResearch = HIGH_SCHOOL_AUDIENCE.test(businessDescription)
      && INSTITUTION.test(candidate.keyword)
      && INSTITUTION_RESEARCH.test(candidate.keyword);
    if (brief && !themeMatch && !contextualSchoolResearch && !strongOfferEvidence && !strongBusinessEvidence) return [];
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
    const themeCanEstablishCoreMatch = Boolean(themeMatch
      && (themeMatch.theme.evidence.some((item) => item.field === "productsServices") || hasBriefOfferAnchor));
    const coreMatch = tokenCoreMatch || Boolean(themeMatch
      && themeCanEstablishCoreMatch
      && themeMatch.theme.priority === "primary"
      && themeMatch.score >= 3.9);
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
  const modifiers = new Set(["accurate", "character", "free", "most", "online", "reliable", "sign", "signup", "unlimited", "word"]);
  const leftTokens = new Set(canonicalTokens(left).filter((token) => !modifiers.has(token)));
  const rightTokens = new Set(canonicalTokens(right).filter((token) => !modifiers.has(token)));
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
  // Near-duplicate and theme-cap suppression are quality preferences, not
  // permission to violate the product's requested pool size. The diversified
  // pass above establishes breadth first; remaining distinct, measured,
  // relevant phrases then fill the final slots.
  if (selected.length < maximum) {
    const selectedIdentities = new Set(selected.map((keyword) => canonicalTokens(keyword.keyword).join(" ")));
    const finalThemeCap = maximum === 25 ? maximum : themeCap;
    for (const keyword of ranked) {
      if (selected.length >= maximum) break;
      const identity = canonicalTokens(keyword.keyword).join(" ");
      if (!identity || selectedIdentities.has(identity) || (counts.get(keyword.themeId) ?? 0) >= finalThemeCap) continue;
      add(keyword);
      selectedIdentities.add(identity);
    }
  }
  return selected.sort((left, right) => left.priorityTier - right.priorityTier
    || right.priorityScore - left.priorityScore
    || Number(right.searchVolume ?? 0) - Number(left.searchVolume ?? 0)
    || left.keyword.localeCompare(right.keyword));
}
