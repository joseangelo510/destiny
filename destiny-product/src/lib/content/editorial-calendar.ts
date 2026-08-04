import { INITIAL_PLAN_WEEKS } from "../product/plan-horizon";
import { keywordHasGeographicConflict } from "../seo/keyword-opportunity";

export type EditorialKeyword = {
  keyword: string;
  themeId?: string;
  themeLabel?: string;
  intent?: string;
  opportunity?: string;
  searchVolume?: number;
  difficulty?: number;
  rank?: number;
  cpc?: number;
};

export function selectKeywordsForCalendar<T extends EditorialKeyword>(
  keywords: T[],
  decisions: Record<string, "approved" | "declined">,
  context: EditorialBusinessContext = {},
): T[] {
  const reviewed = Object.keys(decisions).length > 0;
  if (!reviewed) {
    const demandBacked = keywords.filter((keyword) => Number(keyword.searchVolume ?? 0) > 0
      && automaticCalendarKeywordEligible(keyword, context));
    return demandBacked.length ? demandBacked : keywords;
  }
  return keywords.filter((keyword) => decisions[keyword.keyword] === "approved");
}

export type SearchIntent = "awareness" | "consideration" | "conversion";
export type BusinessModel = "product" | "service";
export type EditorialBusinessContext = {
  productsServices?: string;
  locationEvidence?: string;
  competitorNames?: string[];
};

const GENERIC_JUNK_REMOVAL_MODIFIERS = new Set([
  "affordable", "appliance", "best", "bulk", "cheap", "commercial", "construction", "debris", "eco", "emergency",
  "estate", "friendly", "furniture", "garage", "hoarding", "hot", "house", "local", "mattress", "office", "residential",
  "same", "shed", "trash", "tub", "yard",
]);

function normalizedWords(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function automaticCalendarKeywordEligible(keyword: EditorialKeyword, context: EditorialBusinessContext) {
  const phrase = normalizedWords(keyword.keyword);
  const offer = normalizedWords(context.productsServices ?? "");
  const evidence = normalizedWords(context.locationEvidence ?? "");

  if (/\bfree\b/.test(phrase) && !offer.includes(phrase)) return false;
  if (/\b(?:usa|united states|nationwide|national)\b/.test(phrase)
    && /\b(?:bay area|serving areas|fremont|san jose|san francisco|east bay|south bay)\b/.test(evidence)) return false;

  const competitors = (context.competitorNames ?? []).map(normalizedWords).filter(Boolean);
  if (competitors.some((competitor) => phrase.includes(competitor))) return false;

  const serviceMatch = phrase.match(/^(.+?)\s+junk removal$/);
  if (serviceMatch) {
    const modifier = serviceMatch[1];
    const modifierWords = modifier.split(" ");
    const generic = modifierWords.every((word) => GENERIC_JUNK_REMOVAL_MODIFIERS.has(word));
    const evidencedLocation = modifier.length >= 3 && evidence.includes(modifier);
    if (!generic && !evidencedLocation) return false;
  }
  return true;
}

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
  offerFit: number;
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
const OFFER_STOP_WORDS = new Set([
  "and", "area", "business", "commercial", "company", "customer", "customers", "for", "free", "in", "local",
  "professional", "provide", "residential", "service", "services", "the", "we", "with",
]);

function offerTokens(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/)
    .filter((token) => token.length >= 3 && !OFFER_STOP_WORDS.has(token));
}

function keywordOfferFit(keyword: EditorialKeyword, productsServices = "") {
  const theme = `${keyword.themeId ?? ""} ${keyword.themeLabel ?? ""}`.toLowerCase();
  if (/audience|customer|use case/.test(theme)) return 0;
  if (/product|service|offer/.test(theme)) return 4;
  const offer = new Set(offerTokens(productsServices));
  if (!offer.size) return 1;
  const overlap = new Set(offerTokens(keyword.keyword).filter((token) => offer.has(token))).size;
  if (overlap >= 2) return 3;
  if (overlap === 1) return 1;
  return 0;
}

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

export function prioritizeEditorialKeywords(
  keywords: EditorialKeyword[],
  businessModel: BusinessModel = "service",
  context: EditorialBusinessContext = {},
): PrioritizedEditorialKeyword[] {
  return keywords.filter((keyword) => !keywordHasGeographicConflict(keyword, context)).map((keyword) => {
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
      offerFit: keywordOfferFit(keyword, context.productsServices),
    };
  }).sort((left, right) => right.offerFit - left.offerFit
    || right.businessFit - left.businessFit
    || right.priorityTier - left.priorityTier
    || right.priorityScore - left.priorityScore
    || Number(right.searchVolume ?? 0) - Number(left.searchVolume ?? 0)
    || Number(left.difficulty ?? 0) - Number(right.difficulty ?? 0)
    || left.keyword.localeCompare(right.keyword));
}

export function buildEditorialCalendar(
  keywords: EditorialKeyword[],
  weeks = INITIAL_PLAN_WEEKS,
  businessModel: BusinessModel = "service",
  context: EditorialBusinessContext = {},
): EditorialCalendarItem[] {
  if (!keywords.length) return [];
  const prioritized = prioritizeEditorialKeywords(keywords, businessModel, context);
  if (!prioritized.length) return [];
  const offerAnchored = prioritized.filter((keyword) => keyword.offerFit >= 2);
  const calendarKeywords = offerAnchored.length >= 3 ? offerAnchored : prioritized;
  const angles = businessModel === "product" ? PRODUCT_ANGLES : SERVICE_ANGLES;
  return Array.from({ length: weeks }, (_, index) => {
    const keyword = calendarKeywords[index % calendarKeywords.length];
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
