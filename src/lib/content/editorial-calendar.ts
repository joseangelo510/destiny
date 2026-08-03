export type EditorialKeyword = {
  keyword: string;
  intent?: string;
  opportunity?: string;
  searchVolume?: number;
  difficulty?: number;
  rank?: number;
  cpc?: number;
  /** Semantic cluster id produced by the keyword-research pipeline (e.g. "products-services"). */
  themeId?: string;
  /** Human-readable cluster label (e.g. "Products and services", "Audience use cases"). */
  themeLabel?: string;
};

export type CalendarSelectionContext = {
  /** Business products/services text used to anchor offer tokens. */
  productsServices?: string;
  /** Strategic-page text evidencing the business's real service locations. */
  locationEvidence?: string;
  /** Known competitor names from onboarding (excluded from automatic selection). */
  competitorNames?: string[];
};

// Generic service/commercial qualifiers that never indicate a competitor brand.
const GENERIC_QUALIFIER_TOKENS = new Set([
  "best", "top", "cheap", "cheapest", "affordable", "local", "near", "me",
  "same", "day", "fast", "quick", "emergency", "licensed", "insured",
  "professional", "reliable", "commercial", "residential", "small", "large",
  "full", "eco", "friendly", "green", "service", "services", "company",
  "companies", "cost", "costs", "price", "prices", "pricing", "quote",
  "quotes", "hire", "book", "and", "the", "for", "with", "from", "that",
  "this", "how", "what", "why", "when", "your", "our",
]);

const NATIONAL_SCOPE_RE = /\b(usa|u\.s\.a\.|us|u\.s\.|united states|america|american|nationwide|national)\b/i;
const FREE_SERVICE_RE = /\bfree\b/i;

function normalizeForMatch(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Returns a reason string when a keyword should be excluded in automatic mode,
 * or null when it is safe to keep. Explicit user approvals never pass through
 * this function.
 */
export function automaticCalendarExclusionReason(
  keyword: EditorialKeyword,
  context: CalendarSelectionContext,
): string | null {
  const phrase = normalizeForMatch(keyword.keyword);
  if (!phrase) return null;
  const evidence = normalizeForMatch(context.locationEvidence ?? "");
  const offerText = normalizeForMatch(context.productsServices ?? "");
  const offerTokens = new Set(offerText.split(/\s+/).filter((t) => t.length >= 3));

  // 1. Known onboarding competitor names.
  for (const name of context.competitorNames ?? []) {
    const normalized = normalizeForMatch(name);
    if (normalized && phrase.includes(normalized)) return "competitor name";
  }

  // 2. "Free" service phrases unless the business evidences a free offer.
  if (FREE_SERVICE_RE.test(phrase)) {
    const freeEvidenced = /\bfree\b/.test(offerText) || /\bfree\b/.test(evidence);
    if (!freeEvidenced) return "free service not offered";
  }

  // 3. National/USA scope for an evidenced local business.
  if (evidence && NATIONAL_SCOPE_RE.test(keyword.keyword) && !NATIONAL_SCOPE_RE.test(evidence)) {
    return "national scope for local business";
  }

  // 4. Likely competitor-branded modifiers. Only brand-finding (navigational)
  // searches are candidates for this rule — a navigational query whose
  // modifier is not a generic qualifier, not part of the stated offer, and
  // not evidenced on the site's strategic pages is someone else's brand.
  // Non-navigational keywords with unfamiliar modifiers (e.g. niche service
  // qualifiers) are legitimate and must not be excluded here.
  const isNavigational = String(keyword.intent || "").toLowerCase().includes("navigation");
  if (isNavigational && offerTokens.size) {
    const tokens = phrase.split(/\s+/);
    const hasOfferToken = tokens.some((t) => offerTokens.has(t));
    if (hasOfferToken) {
      const unknown = tokens.filter((t) =>
        !GENERIC_QUALIFIER_TOKENS.has(t)
        && !offerTokens.has(t)
        && !(evidence && evidence.includes(t)));
      if (unknown.length > 0) return "likely branded modifier";
    }
  }

  return null;
}

export function selectKeywordsForCalendar<T extends EditorialKeyword>(
  keywords: T[],
  decisions: Record<string, "approved" | "declined">,
  context?: CalendarSelectionContext,
): T[] {
  const reviewed = Object.keys(decisions).length > 0;
  if (!reviewed) {
    // Automatic mode (no user decisions yet): apply safety exclusions first —
    // competitor brands, unoffered "free" terms, and out-of-scope national
    // phrases cannot reach the calendar without an explicit approval.
    const safe = context
      ? keywords.filter((kw) => automaticCalendarExclusionReason(kw, context) === null)
      : keywords;
    // If the safeguards excluded everything, fall back to the raw list rather
    // than emptying the calendar.
    const pool = safe.length > 0 ? safe : keywords;
    // Suppress zero-volume noise when at least one demand-backed candidate
    // exists. When every candidate has zero volume (e.g. volume data has not
    // yet arrived), preserve the full list rather than returning nothing.
    const demandBacked = pool.filter((kw) => Number(kw.searchVolume ?? 0) > 0);
    return demandBacked.length > 0 ? demandBacked : pool;
  }
  // Explicit decisions: honour approved keywords regardless of volume or
  // automatic safeguards — the user's judgement overrides every filter.
  return keywords.filter((keyword) => decisions[keyword.keyword] === "approved");
}

export type SearchIntent = "awareness" | "consideration" | "conversion";
export type BusinessModel = "product" | "service";

export type EditorialContext = {
  /** Business products/services for offer-fit scoring. */
  productsServices?: string;
  /** Concatenated page text from the website's inspected pages. */
  pageText?: string;
};

export const SEARCH_INTENT_DEFINITIONS: Record<SearchIntent, {
  label: string;
  summary: string;
  description: string;
}> = {
  awareness: {
    label: "Awareness",
    summary: "Learning and early research",
    description: "Educational searches from people learning about a topic, problem, or possible purchase.",
  },
  consideration: {
    label: "Consideration",
    summary: "Evaluating the best solution",
    description: "Evaluation searches from people comparing competitors, options, or the best solution for their needs.",
  },
  conversion: {
    label: "Conversion",
    summary: "Ready to take action",
    description: "Action-ready searches for pricing, where to buy or hire, where to sign up, availability, or promo codes.",
  },
};

export type EditorialCalendarItem = {
  month: number;
  week: number;
  contentType: string;
  title: string;
  focusKeyword: string;
  searchIntent: SearchIntent;
  evidence: string;
  searchVolume: number;
  difficulty: number;
  priorityReason: string;
  status: "Review draft" | "Planned";
};

const SERVICE_ANGLES = [
  { contentType: "Service page", title: (keyword: string) => `Where to hire help for ${keyword}` },
  { contentType: "Comparison page", title: (keyword: string) => `${keyword}: options, tradeoffs, and who each is for` },
  { contentType: "Pricing guide", title: (keyword: string) => `${keyword}: pricing, effort, and expected value` },
  { contentType: "Landing page", title: (keyword: string) => `Get started with ${keyword}: options, pricing, and next steps` },
  { contentType: "Buyer guide", title: (keyword: string) => `How to evaluate ${keyword} before you decide` },
  { contentType: "Blog guide", title: (keyword: string) => `The complete guide to ${keyword}` },
  { contentType: "FAQ article", title: (keyword: string) => `${keyword}: the questions customers ask first` },
  { contentType: "Case study", title: (keyword: string) => `How a customer approached ${keyword}` },
  { contentType: "Blog article", title: (keyword: string) => `The most common ${keyword} mistakes and how to avoid them` },
  { contentType: "How-to guide", title: (keyword: string) => `A step-by-step plan for ${keyword}` },
  { contentType: "Checklist", title: (keyword: string) => `A practical ${keyword} checklist` },
  { contentType: "Blog article", title: (keyword: string) => `How long ${keyword} takes and what happens next` },
  { contentType: "Examples article", title: (keyword: string) => `${keyword}: real examples and useful patterns` },
  { contentType: "Blog article", title: (keyword: string) => `A focused strategy for ${keyword}` },
  { contentType: "Evaluation guide", title: (keyword: string) => `The criteria that matter most for ${keyword}` },
  { contentType: "Alternatives page", title: (keyword: string) => `${keyword}: alternatives worth considering` },
  { contentType: "Blog article", title: (keyword: string) => `A simple framework for ${keyword}` },
  { contentType: "Research report", title: (keyword: string) => `${keyword}: benchmarks and signals to watch` },
  { contentType: "Downloadable toolkit", title: (keyword: string) => `The ${keyword} planning toolkit` },
  { contentType: "FAQ article", title: (keyword: string) => `More answers to common ${keyword} questions` },
  { contentType: "Interview article", title: (keyword: string) => `An expert perspective on ${keyword}` },
  { contentType: "Glossary", title: (keyword: string) => `${keyword}: terms and concepts explained plainly` },
  { contentType: "Blog article", title: (keyword: string) => `${keyword}: myths, facts, and better decisions` },
  { contentType: "Trend report", title: (keyword: string) => `What is changing in ${keyword}` },
] as const satisfies ReadonlyArray<{
  contentType: string;
  title: (keyword: string) => string;
}>;

const PRODUCT_ANGLES = [
  { contentType: "Product category page", title: (keyword: string) => `Shop ${keyword}: options, benefits, and what to choose` },
  { contentType: "Comparison page", title: (keyword: string) => `${keyword}: compare options, features, and value` },
  { contentType: "Buying guide", title: (keyword: string) => `${keyword}: pricing, features, and what to buy` },
  { contentType: "Product landing page", title: (keyword: string) => `Find the right ${keyword}: options, pricing, and next steps` },
  { contentType: "Buyer guide", title: (keyword: string) => `How to choose ${keyword} before you buy` },
  { contentType: "Product guide", title: (keyword: string) => `The complete guide to ${keyword}` },
  { contentType: "FAQ article", title: (keyword: string) => `${keyword}: the questions customers ask first` },
  { contentType: "Customer story", title: (keyword: string) => `How one customer chose ${keyword}` },
  { contentType: "Blog article", title: (keyword: string) => `The most common ${keyword} mistakes and how to avoid them` },
  { contentType: "How-to guide", title: (keyword: string) => `How to use ${keyword}: a step-by-step guide` },
  { contentType: "Checklist", title: (keyword: string) => `A practical ${keyword} buying checklist` },
  { contentType: "Blog article", title: (keyword: string) => `How to get the most from ${keyword}` },
  { contentType: "Examples article", title: (keyword: string) => `${keyword}: real examples and useful patterns` },
  { contentType: "Product guide", title: (keyword: string) => `A practical way to compare ${keyword}` },
  { contentType: "Evaluation guide", title: (keyword: string) => `The criteria that matter most for ${keyword}` },
  { contentType: "Alternatives page", title: (keyword: string) => `${keyword}: alternatives worth considering` },
  { contentType: "Blog article", title: (keyword: string) => `A simple framework for choosing ${keyword}` },
  { contentType: "Research report", title: (keyword: string) => `${keyword}: benchmarks and signals to watch` },
  { contentType: "Downloadable comparison", title: (keyword: string) => `The ${keyword} comparison toolkit` },
  { contentType: "FAQ article", title: (keyword: string) => `More answers to common ${keyword} questions` },
  { contentType: "Expert review", title: (keyword: string) => `An expert perspective on ${keyword}` },
  { contentType: "Glossary", title: (keyword: string) => `${keyword}: terms and concepts explained plainly` },
  { contentType: "Blog article", title: (keyword: string) => `${keyword}: myths, facts, and better decisions` },
  { contentType: "Trend report", title: (keyword: string) => `What is changing in ${keyword}` },
] as const satisfies ReadonlyArray<{
  contentType: string;
  title: (keyword: string) => string;
}>;

const PRODUCT_LANGUAGE = /\b(products?|goods|kits?|refills?|bottles?|devices?|equipment|merchandise|retail|shop|store)\b/i;
const SERVICE_LANGUAGE = /\b(services?|consulting|coaching|counseling|maintenance|repair|installation|care|management|agency|mowing|cleanup)\b/i;

export function inferBusinessModel(productsServices: string): BusinessModel {
  const productMatch = PRODUCT_LANGUAGE.test(productsServices);
  const serviceMatch = SERVICE_LANGUAGE.test(productsServices);
  if (productMatch && !serviceMatch) return "product";
  if (serviceMatch && !productMatch) return "service";
  if (productMatch) return "product";
  return "service";
}

type ProviderIntent = "transactional" | "commercial" | "navigational" | "informational";

export type PrioritizedEditorialKeyword = EditorialKeyword & {
  providerIntent: ProviderIntent;
  searchIntent: SearchIntent;
  businessFit: number;
  priorityTier: number;
  priorityScore: number;
  priorityReason: string;
};

const INTENT_WEIGHT: Record<ProviderIntent, number> = {
  transactional: 1.15,
  commercial: 0.8,
  navigational: 0.3,
  informational: 0.25,
};

const INTENT_LABEL: Record<ProviderIntent, string> = {
  transactional: "Buying intent",
  commercial: "Comparison intent",
  navigational: "Brand-finding intent",
  informational: "Learning intent",
};

const CONVERSION_LANGUAGE = /\b(buy|book|call|coupon|discount|for sale|hire|near me|order|pricing|promo code|quote|schedule|sign up|subscribe)\b/i;
const COMMERCIAL_LANGUAGE = /\b(affordable|alternative|best|compare|comparison|reviews?|top|versus|vs\.?|which)\b/i;
const PRODUCT_QUERY_LANGUAGE = /\b(bottles?|buy|devices?|equipment|for sale|goods|kits?|machines?|mowers?|products?|refills?|shop|sprays?|supplies|tools?)\b/i;
const SERVICE_QUERY_LANGUAGE = /\b(book|companies|company|contractors?|cost|hire|near me|pricing|professionals?|providers?|quote|services?|specialists?)\b/i;

function normalizedIntent(keyword: EditorialKeyword): ProviderIntent {
  if (CONVERSION_LANGUAGE.test(keyword.keyword)) return "transactional";
  if (COMMERCIAL_LANGUAGE.test(keyword.keyword)) return "commercial";
  const intent = String(keyword.intent || "informational").toLowerCase();
  if (intent.includes("transaction") || intent.includes("conversion")) return "transactional";
  if (intent.includes("commercial") || intent.includes("consideration")) return "commercial";
  if (intent.includes("navigational") || intent.includes("navigation")) return "navigational";
  return "informational";
}

function productIntent(intent: ProviderIntent): SearchIntent {
  if (intent === "transactional") return "conversion";
  if (intent === "commercial" || intent === "navigational") return "consideration";
  return "awareness";
}

function opportunityMultiplier(keyword: EditorialKeyword) {
  const rank = Number(keyword.rank ?? 0);
  if (keyword.opportunity === "existing_rank" && rank >= 4 && rank <= 20) return 1.25;
  if (keyword.opportunity === "competitor_gap") return 1.1;
  if (keyword.opportunity === "existing_rank") return 1.08;
  return 1;
}

function priorityReason(keyword: EditorialKeyword, intent: ProviderIntent) {
  const volume = Number(keyword.searchVolume ?? 0);
  const rank = Number(keyword.rank ?? 0);
  const evidence = keyword.opportunity === "competitor_gap"
    ? "competitor gap"
    : rank > 0
      ? `rank #${rank}`
      : "site opportunity";
  return `${INTENT_LABEL[intent]} · ${volume.toLocaleString()} monthly searches · ${evidence}`;
}

function revenuePriorityTier(intent: ProviderIntent, volume: number) {
  if (intent === "transactional" && volume >= 100) return 3;
  if (intent === "commercial" && volume >= 30) return 2;
  if (intent === "transactional" && volume > 0) return 1;
  return 0;
}

function businessKeywordFit(keyword: string, businessModel: BusinessModel) {
  const productMatch = PRODUCT_QUERY_LANGUAGE.test(keyword);
  const serviceMatch = SERVICE_QUERY_LANGUAGE.test(keyword);
  if (businessModel === "service") {
    if (serviceMatch) return 2;
    if (productMatch) return 0;
    return 1;
  }
  if (productMatch) return 2;
  if (serviceMatch) return 0;
  return 1;
}

// US city/metro phrases for geographic relevance filtering in the calendar.
const US_CITY_PHRASES_EC: readonly string[] = [
  "los angeles", "manhattan", "new york city", "nyc", "brooklyn",
  "boston", "houston", "green bay", "seattle", "chicago", "philadelphia",
  "fremont", "bay area", "san francisco", "san jose", "san diego",
  "dallas", "austin", "denver", "miami", "atlanta", "phoenix",
  "minneapolis", "portland", "las vegas",
];

function editorialGeoConflict(keyword: string, pageText: string): boolean {
  if (!pageText.trim()) return false;
  const kw = keyword.toLowerCase();
  const ev = pageText.toLowerCase();
  return US_CITY_PHRASES_EC.some((city) => kw.includes(city) && !ev.includes(city));
}

function editorialOfferTokenSet(productsServices: string): Set<string> {
  return new Set(
    productsServices.toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !["and", "the", "for", "with", "from", "that", "this"].includes(t)),
  );
}

// Patterns that identify a semantic theme as audience/customer-facing (not an offer).
const AUDIENCE_THEME_RE = /\b(audience|customer|use.?case|buyer|persona|segment)\b/i;
// Patterns that identify a semantic theme as product/service/offer-facing.
const OFFER_THEME_RE = /\b(product|service|offer|solution|feature)\b/i;

/**
 * Returns how strongly a keyword fits the business's offer.
 * - Returns 0  when the semantic theme labels it as audience/customer/use-case.
 * - Returns 4  when the semantic theme labels it as product/service/offer.
 * - Falls back to token-overlap count when no decisive theme exists.
 * - Returns 1  when there are no offer tokens (no context → pass through).
 */
function editorialKeywordOfferFit(kw: PrioritizedEditorialKeyword, offerTokens: Set<string>): number {
  if (!offerTokens.size) return 1; // no context → pass through
  // Decisive semantic theme wins over token overlap.
  if (kw.themeLabel) {
    if (AUDIENCE_THEME_RE.test(kw.themeLabel)) return 0;
    if (OFFER_THEME_RE.test(kw.themeLabel)) return 4;
  }
  // Fall back to token overlap.
  return kw.keyword.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/)
    .filter((t) => offerTokens.has(t)).length;
}

export function prioritizeEditorialKeywords(keywords: EditorialKeyword[], businessModel: BusinessModel = "service"): PrioritizedEditorialKeyword[] {
  return keywords.map((keyword) => {
    const providerIntent = normalizedIntent(keyword);
    const volume = Math.max(0, Number(keyword.searchVolume ?? 0));
    const difficulty = Math.min(100, Math.max(0, Number(keyword.difficulty ?? 0)));
    const cpc = Math.min(10, Math.max(0, Number(keyword.cpc ?? 0)));
    const demandPenalty = volume === 0 ? 0.45 : volume < 30 && providerIntent !== "transactional" ? 0.7 : 1;
    const priorityScore = INTENT_WEIGHT[providerIntent]
      * Math.log10(Math.max(volume, 10))
      * (1 - (difficulty / 100 * 0.6))
      * (1 + (cpc / 10 * 0.5))
      * opportunityMultiplier(keyword)
      * demandPenalty;
    return {
      ...keyword,
      providerIntent,
      searchIntent: productIntent(providerIntent),
      businessFit: businessKeywordFit(keyword.keyword, businessModel),
      priorityTier: revenuePriorityTier(providerIntent, volume),
      priorityScore,
      priorityReason: priorityReason(keyword, providerIntent),
    };
  }).sort((left, right) => right.businessFit - left.businessFit
    || right.priorityTier - left.priorityTier
    || right.priorityScore - left.priorityScore
    || Number(right.searchVolume ?? 0) - Number(left.searchVolume ?? 0)
    || Number(left.difficulty ?? 0) - Number(right.difficulty ?? 0)
    || left.keyword.localeCompare(right.keyword));
}

export function buildEditorialCalendar(keywords: EditorialKeyword[], weeks = 24, businessModel: BusinessModel = "service", context?: EditorialContext): EditorialCalendarItem[] {
  if (!keywords.length) return [];
  const prioritized = prioritizeEditorialKeywords(keywords, businessModel);
  // Offer-fit filter: when ≥3 offer-anchored keywords exist, drop audience-only phrases.
  const offerTokens = editorialOfferTokenSet(context?.productsServices ?? "");
  const offerAnchored = prioritized.filter((kw) => kw.opportunity === "existing_rank" || editorialKeywordOfferFit(kw, offerTokens) > 0);
  const afterOfferFilter = offerAnchored.length >= 3 ? offerAnchored : prioritized;
  // Geographic filter: drop keywords whose city is absent from page-text evidence.
  const pageText = context?.pageText ?? "";
  const afterGeoFilter = pageText
    ? afterOfferFilter.filter((kw) => kw.opportunity === "existing_rank" || !editorialGeoConflict(kw.keyword, pageText))
    : afterOfferFilter;
  const pool = afterGeoFilter.length ? afterGeoFilter : prioritized;
  const angles = businessModel === "product" ? PRODUCT_ANGLES : SERVICE_ANGLES;
  return Array.from({ length: weeks }, (_, index) => {
    const keyword = pool[index % pool.length];
    const angle = angles[index % angles.length];
    const opportunity = keyword.opportunity || "site_idea";
    const evidence = opportunity === "competitor_gap"
      ? "Competitor gap"
      : opportunity === "existing_rank"
        ? `Current rank ${Number(keyword.rank ?? 0) || "—"}`
        : "Relevant site idea";
    return {
      month: Math.floor(index / 4) + 1,
      week: (index % 4) + 1,
      contentType: angle.contentType,
      title: angle.title(keyword.keyword),
      focusKeyword: keyword.keyword,
      searchIntent: keyword.searchIntent,
      evidence,
      searchVolume: Number(keyword.searchVolume ?? 0),
      difficulty: Number(keyword.difficulty ?? 0),
      priorityReason: keyword.priorityReason,
      status: index < 4 ? "Review draft" : "Planned",
    };
  });
}
