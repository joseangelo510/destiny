export type EditorialKeyword = {
  keyword: string;
  intent?: string;
  opportunity?: string;
  searchVolume?: number;
  difficulty?: number;
  rank?: number;
};

export type SearchIntent = "awareness" | "consideration" | "conversion";

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
  status: "Review draft" | "Planned";
};

const ANGLES = [
  { contentType: "Blog guide", searchIntent: "awareness", title: (keyword: string) => `The complete guide to ${keyword}` },
  { contentType: "FAQ article", searchIntent: "awareness", title: (keyword: string) => `${keyword}: the questions customers ask first` },
  { contentType: "Checklist", searchIntent: "consideration", title: (keyword: string) => `A practical ${keyword} checklist` },
  { contentType: "Comparison page", searchIntent: "consideration", title: (keyword: string) => `${keyword}: options, tradeoffs, and who each is for` },
  { contentType: "Blog article", searchIntent: "awareness", title: (keyword: string) => `The most common ${keyword} mistakes and how to avoid them` },
  { contentType: "Case study", searchIntent: "consideration", title: (keyword: string) => `How a customer approached ${keyword}` },
  { contentType: "Buyer guide", searchIntent: "consideration", title: (keyword: string) => `How to evaluate ${keyword} before you decide` },
  { contentType: "How-to guide", searchIntent: "awareness", title: (keyword: string) => `A step-by-step plan for ${keyword}` },
  { contentType: "Pricing guide", searchIntent: "conversion", title: (keyword: string) => `${keyword}: pricing, effort, and expected value` },
  { contentType: "Blog article", searchIntent: "awareness", title: (keyword: string) => `How long ${keyword} takes and what happens next` },
  { contentType: "Examples article", searchIntent: "awareness", title: (keyword: string) => `${keyword}: real examples and useful patterns` },
  { contentType: "Blog article", searchIntent: "awareness", title: (keyword: string) => `A focused strategy for ${keyword}` },
  { contentType: "Evaluation guide", searchIntent: "consideration", title: (keyword: string) => `The criteria that matter most for ${keyword}` },
  { contentType: "Alternatives page", searchIntent: "consideration", title: (keyword: string) => `${keyword}: alternatives worth considering` },
  { contentType: "Blog article", searchIntent: "awareness", title: (keyword: string) => `A simple framework for ${keyword}` },
  { contentType: "Research report", searchIntent: "awareness", title: (keyword: string) => `${keyword}: benchmarks and signals to watch` },
  { contentType: "Downloadable toolkit", searchIntent: "consideration", title: (keyword: string) => `The ${keyword} planning toolkit` },
  { contentType: "FAQ article", searchIntent: "awareness", title: (keyword: string) => `More answers to common ${keyword} questions` },
  { contentType: "Interview article", searchIntent: "awareness", title: (keyword: string) => `An expert perspective on ${keyword}` },
  { contentType: "Glossary", searchIntent: "awareness", title: (keyword: string) => `${keyword}: terms and concepts explained plainly` },
  { contentType: "Blog article", searchIntent: "awareness", title: (keyword: string) => `${keyword}: myths, facts, and better decisions` },
  { contentType: "Service page", searchIntent: "conversion", title: (keyword: string) => `Where to hire help for ${keyword}` },
  { contentType: "Trend report", searchIntent: "awareness", title: (keyword: string) => `What is changing in ${keyword}` },
  { contentType: "Landing page", searchIntent: "conversion", title: (keyword: string) => `Get started with ${keyword}: options, pricing, and next steps` },
] as const satisfies ReadonlyArray<{
  contentType: string;
  searchIntent: SearchIntent;
  title: (keyword: string) => string;
}>;

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
      title: angle.title(keyword.keyword),
      focusKeyword: keyword.keyword,
      searchIntent: angle.searchIntent,
      evidence,
      searchVolume: Number(keyword.searchVolume ?? 0),
      difficulty: Number(keyword.difficulty ?? 0),
      status: index < 4 ? "Review draft" : "Planned",
    };
  });
}
