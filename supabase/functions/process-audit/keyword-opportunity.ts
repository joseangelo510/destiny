export type KeywordCandidate = {
  keyword: string;
  rank?: number;
  searchVolume?: number;
  difficulty?: number;
  cpc?: number;
  intent?: string;
  opportunity?: string;
  competitorRankers?: number;
  [key: string]: unknown;
};

export type KeywordBusinessContext = {
  productsServices?: string;
  problemSolved?: string;
  idealCustomer?: string;
  audienceChallengesGoals?: string;
  market?: string;
};

export type ProviderIntent = "transactional" | "commercial" | "navigational" | "informational";
export type CustomerIntent = "conversion" | "consideration" | "awareness";

export type RankedKeywordOpportunity<T extends KeywordCandidate = KeywordCandidate> = T & {
  providerIntent: ProviderIntent;
  searchIntent: CustomerIntent;
  businessFit: number;
  priorityScore: number;
  priorityReason: string;
};

const STOP_WORDS = new Set([
  "a", "about", "and", "are", "as", "at", "be", "business", "by", "customer", "customers", "for", "from", "help", "in", "into", "is", "it", "of", "on", "or", "our", "people", "provide", "service", "services", "that", "the", "their", "them", "they", "this", "to", "want", "we", "who", "with", "you", "your",
]);

const TOKEN_FAMILIES: Record<string, string> = {
  admission: "admission", admissions: "admission",
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
const COMMERCIAL = /\b(?:affordable|alternative|alternatives|best|compare|comparison|consultant|consultants|counselor|counselors|reviews?|services?|top|versus|vs\.?)\b/i;
const INFORMATIONAL = /^(?:how|what|when|where|why|guide|tips?|examples?|ideas?|checklist)\b/i;
const NOISE = /\b(?:careers?|jobs?|login|password|portal|sign in|torrent|download free)\b/i;

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

function contextTokens(context: KeywordBusinessContext) {
  return new Set(canonicalTokens([
    context.productsServices,
    context.problemSolved,
    context.idealCustomer,
    context.audienceChallengesGoals,
    context.market,
  ].filter(Boolean).join(" ")));
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
  return 35 * ({ transactional: 1, commercial: 0.85, navigational: 0.3, informational: 0.25 }[intent]);
}

function opportunityPoints(candidate: KeywordCandidate) {
  const rank = Math.max(0, Number(candidate.rank ?? 0));
  const competitors = Math.max(0, Number(candidate.competitorRankers ?? 0));
  if (candidate.opportunity === "existing_rank" && rank >= 4 && rank <= 20) return 15;
  if (candidate.opportunity === "competitor_gap") return Math.min(15, 10 + competitors * 2);
  if (candidate.opportunity === "existing_rank") return 10;
  return 6;
}

function priorityReason(candidate: KeywordCandidate, intent: ProviderIntent) {
  const label = intent === "transactional" ? "Buying intent"
    : intent === "commercial" ? "Comparison intent"
      : intent === "navigational" ? "Brand-finding intent"
        : "Learning intent";
  const volume = Math.max(0, Number(candidate.searchVolume ?? 0)).toLocaleString();
  const rank = Math.max(0, Number(candidate.rank ?? 0));
  const competitors = Math.max(0, Number(candidate.competitorRankers ?? 0));
  const evidence = candidate.opportunity === "competitor_gap"
    ? `${competitors || "Competitors"} competitor${competitors === 1 ? "" : "s"} rank, you do not`
    : candidate.opportunity === "existing_rank" && rank
      ? `you rank #${rank}`
      : "new relevant opportunity";
  return `${label} · ${volume} monthly searches · ${evidence}`;
}

export function rankKeywordOpportunities<T extends KeywordCandidate>(
  candidates: T[],
  context: KeywordBusinessContext,
  limit = 50,
): Array<RankedKeywordOpportunity<T>> {
  const business = contextTokens(context);
  const seen = new Set<string>();
  const ranked = candidates.flatMap((candidate) => {
    const identity = canonicalTokens(candidate.keyword).join(" ");
    if (!identity || seen.has(identity) || isNoise(candidate.keyword)) return [];
    seen.add(identity);
    const keywordTokens = new Set(canonicalTokens(candidate.keyword));
    const overlap = [...keywordTokens].filter((token) => business.has(token)).length;
    if (business.size && overlap === 0) return [];
    const businessFit = business.size ? Math.min(1, overlap / Math.min(3, keywordTokens.size || 1)) : 0.5;
    const providerIntent = inferIntent(candidate);
    const volume = Math.max(0, Number(candidate.searchVolume ?? 0));
    const difficulty = Math.min(100, Math.max(0, Number(candidate.difficulty ?? 0)));
    const cpc = Math.max(0, Number(candidate.cpc ?? 0));
    const volumePoints = Math.min(20, 20 * Math.log10(volume + 1) / 4.5);
    const attainabilityPoints = Math.max(0, 20 * (1 - difficulty / 100));
    const valuePoints = Math.min(10, 10 * Math.log10(cpc + 1) / 1.7);
    const demandPenalty = volume === 0 ? 12 : volume < 20 && providerIntent !== "transactional" ? 5 : 0;
    const priorityScore = Math.round(Math.max(0, Math.min(100,
      intentPoints(providerIntent) + volumePoints + attainabilityPoints + valuePoints + opportunityPoints(candidate) - demandPenalty,
    )));
    return [{
      ...candidate,
      providerIntent,
      searchIntent: customerIntent(providerIntent),
      businessFit: Math.round(businessFit * 100) / 100,
      priorityScore,
      priorityReason: priorityReason(candidate, providerIntent),
    } as RankedKeywordOpportunity<T>];
  });
  return ranked.sort((left, right) => right.priorityScore - left.priorityScore
    || right.businessFit - left.businessFit
    || Number(right.searchVolume ?? 0) - Number(left.searchVolume ?? 0)
    || left.keyword.localeCompare(right.keyword)).slice(0, Math.max(0, limit));
}
