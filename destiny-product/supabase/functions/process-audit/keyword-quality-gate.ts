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

type Candidate = { keyword: string; searchVolume?: number; opportunity?: string };
type BusinessContext = {
  productsServices?: string;
  problemSolved?: string;
  idealCustomer?: string;
  audienceChallengesGoals?: string;
  differentiation?: string;
  market?: string;
  locationEvidence?: string;
};

const NOISE = /\b(?:careers?|jobs?|login|password|portal|sign in|torrent|download free)\b/i;
const PROOF_OR_SENTENCE_FRAGMENT = /\b(?:customers? need|earned|five[ -]star|served)\b/i;
const COPIED_BUSINESS_LANGUAGE = /(?:^\s*(?:serve|serving)\b|\b\d+\s*(?:five[ -]star|5[ -]star|star)\s+reviews?\b)/i;
const SERVICE_PROVIDER_QUERY = /\b(?:agency|consultants?|consulting|experts?|services?)\b/i;
const SERVICE_BUSINESS = /\b(?:agency|coach|coaching|consultant|consulting|counseling|counselor|guidance|service|services)\b/i;
const SOFTWARE_PRODUCT = /\b(?:app|apps|crm|platform|saas|software|system|tool|tools)\b/i;
const SERVICE_ACTION_QUERY = /\b(?:agency|cleanouts?|coach|coaches|coaching|consultant|consultants|consulting|counseling|counselor|counselors|disposal|haul|hauling|management|pickup|removal|services?)\b/i;

export const KNOWN_LOCATION_PHRASES = [
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

function normalizedPhrase(value: string) {
  return ` ${value.normalize("NFKC").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
}

export function keywordHasGeographicConflict(candidate: Pick<Candidate, "keyword" | "opportunity">, context: BusinessContext) {
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

export function contextIsServiceBusiness(context: BusinessContext, description: string) {
  return SERVICE_BUSINESS.test(description) || SERVICE_ACTION_QUERY.test(context.productsServices ?? "");
}

export function isNoise(keyword: string) {
  const normalized = keyword.trim();
  if (!normalized || NOISE.test(normalized)) return true;
  const tokens = normalized.match(/[a-z]+|\d+/gi) ?? [];
  const numeric = tokens.filter((token) => /^\d+$/.test(token)).length;
  return numeric >= 2 && numeric / Math.max(tokens.length, 1) >= 0.4;
}

/** Reject unmeasured, malformed, mismatched, or unsupported owner-facing keyword ideas before scoring. */
export function keywordQualityGate(candidate: Candidate, context: BusinessContext): KeywordQualityGateResult {
  const volume = Number(candidate.searchVolume);
  if (!Number.isFinite(volume) || volume <= 0) return { accepted: false, rejectionReasons: ["no_measured_demand"] };
  const keyword = String(candidate.keyword ?? "").normalize("NFKC").trim();
  const tokens = keyword.match(/[a-z]+|\d+/gi) ?? [];
  if (tokens.length < 2 || PROOF_OR_SENTENCE_FRAGMENT.test(keyword) || COPIED_BUSINESS_LANGUAGE.test(keyword)) {
    return { accepted: false, rejectionReasons: ["not_a_search_phrase"] };
  }
  if (isNoise(keyword)) return { accepted: false, rejectionReasons: ["search_noise"] };
  const description = [context.productsServices, context.problemSolved, context.idealCustomer, context.audienceChallengesGoals, context.differentiation, context.market, context.locationEvidence].filter(Boolean).join(" ");
  const serviceBusiness = contextIsServiceBusiness(context, description);
  const businessOffersSoftware = SOFTWARE_PRODUCT.test(description);
  if ((serviceBusiness && !businessOffersSoftware && SOFTWARE_PRODUCT.test(keyword)) || (businessOffersSoftware && !serviceBusiness && SERVICE_PROVIDER_QUERY.test(keyword))) {
    return { accepted: false, rejectionReasons: ["unsupported_business_model"] };
  }
  if (keywordHasGeographicConflict(candidate, context)) return { accepted: false, rejectionReasons: ["unsupported_location"] };
  return { accepted: true, rejectionReasons: [] };
}
