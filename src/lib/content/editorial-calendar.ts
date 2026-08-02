export type SearchIntent = "awareness" | "consideration" | "conversion";

export type SearchIntentDefinition = {
  label: string;
  summary: string;
  description: string;
};

export const SEARCH_INTENT_DEFINITIONS: Record<SearchIntent, SearchIntentDefinition> = {
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

export type EditorialKeyword = {
  keyword: string;
  intent?: string;
  opportunity?: string;
  searchVolume?: number;
  difficulty?: number;
  rank?: number;
};

export type EditorialCalendarItem = {
  month: number;
  week: number;
  contentType: string;
  searchIntent: SearchIntent;
  title: string;
  focusKeyword: string;
  evidence: string;
  searchVolume: number;
  difficulty: number;
  status: "Review draft" | "Planned";
};

const ANGLES: Array<{
  contentType: string;
  searchIntent: SearchIntent;
  title: (keyword: string) => string;
}> = [
  // 0 — Blog guide · awareness
  { contentType: "Blog guide",          searchIntent: "awareness",     title: (k) => `The complete guide to ${k}` },
  // 1 — FAQ article · awareness
  { contentType: "FAQ article",         searchIntent: "awareness",     title: (k) => `${k}: the questions customers ask first` },
  // 2 — Checklist · consideration
  { contentType: "Checklist",           searchIntent: "consideration", title: (k) => `A practical ${k} checklist` },
  // 3 — Comparison page · consideration
  { contentType: "Comparison page",     searchIntent: "consideration", title: (k) => `${k}: options, tradeoffs, and who each is for` },
  // 4 — Blog article · awareness (educational expert advice)
  { contentType: "Blog article",        searchIntent: "awareness",     title: (k) => `The most common ${k} mistakes and how to avoid them` },
  // 5 — Case study · consideration (evaluating real-world solutions)
  { contentType: "Case study",          searchIntent: "consideration", title: (k) => `How a customer approached ${k}` },
  // 6 — Buyer guide · consideration
  { contentType: "Buyer guide",         searchIntent: "consideration", title: (k) => `How to evaluate ${k} before you decide` },
  // 7 — How-to guide · awareness (learning process)
  { contentType: "How-to guide",        searchIntent: "awareness",     title: (k) => `A step-by-step plan for ${k}` },
  // 8 — Pricing guide · conversion (title mentions pricing)
  { contentType: "Pricing guide",       searchIntent: "conversion",    title: (k) => `${k}: pricing, costs, and what to expect` },
  // 9 — Blog article · awareness (learning about timelines)
  { contentType: "Blog article",        searchIntent: "awareness",     title: (k) => `How long ${k} takes and what happens next` },
  // 10 — Examples article · awareness
  { contentType: "Examples article",    searchIntent: "awareness",     title: (k) => `${k}: real examples and useful patterns` },
  // 11 — Blog article · awareness (strategy is educational)
  { contentType: "Blog article",        searchIntent: "awareness",     title: (k) => `A focused strategy for ${k}` },
  // 12 — Evaluation guide · consideration
  { contentType: "Evaluation guide",    searchIntent: "consideration", title: (k) => `The criteria that matter most for ${k}` },
  // 13 — Alternatives page · consideration
  { contentType: "Alternatives page",   searchIntent: "consideration", title: (k) => `${k}: alternatives worth considering` },
  // 14 — Blog article · awareness (framework = educational)
  { contentType: "Blog article",        searchIntent: "awareness",     title: (k) => `A simple framework for ${k}` },
  // 15 — Research report · awareness (benchmark/research)
  { contentType: "Research report",     searchIntent: "awareness",     title: (k) => `${k}: benchmarks and signals to watch` },
  // 16 — Downloadable toolkit · consideration (people evaluating which resources to use)
  { contentType: "Downloadable toolkit", searchIntent: "consideration", title: (k) => `The ${k} planning toolkit` },
  // 17 — FAQ article · awareness
  { contentType: "FAQ article",         searchIntent: "awareness",     title: (k) => `More answers to common ${k} questions` },
  // 18 — Interview article · awareness (educational perspective)
  { contentType: "Interview article",   searchIntent: "awareness",     title: (k) => `An expert perspective on ${k}` },
  // 19 — Glossary · awareness
  { contentType: "Glossary",            searchIntent: "awareness",     title: (k) => `${k}: terms and concepts explained plainly` },
  // 20 — Blog article · awareness (myth-busting = educational)
  { contentType: "Blog article",        searchIntent: "awareness",     title: (k) => `${k}: myths, facts, and better decisions` },
  // 21 — Service page · conversion, title "Where to hire help for <keyword>"
  { contentType: "Service page",        searchIntent: "conversion",    title: (k) => `Where to hire help for ${k}` },
  // 22 — Trend report · awareness (research/trends)
  { contentType: "Trend report",        searchIntent: "awareness",     title: (k) => `What is changing in ${k}` },
  // 23 — Landing page · conversion, title with options/pricing/next steps
  { contentType: "Landing page",        searchIntent: "conversion",    title: (k) => `Get started with ${k}: options, pricing, and next steps` },
];

export function buildEditorialCalendar(keywords: EditorialKeyword[], weeks = 24): EditorialCalendarItem[] {
  if (!keywords.length) return [];
  return Array.from({ length: weeks }, (_, index) => {
    const keyword = keywords[index % keywords.length];
    const angle = ANGLES[index % ANGLES.length];
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
      searchIntent: angle.searchIntent,
      title: angle.title(keyword.keyword),
      focusKeyword: keyword.keyword,
      evidence,
      searchVolume: Number(keyword.searchVolume ?? 0),
      difficulty: Number(keyword.difficulty ?? 0),
      status: index < 4 ? "Review draft" : "Planned",
    };
  });
}
