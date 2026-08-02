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
  type: string;
  title: string;
  focusKeyword: string;
  intent: string;
  evidence: string;
  searchVolume: number;
  difficulty: number;
  status: "Review draft" | "Planned";
};

const ANGLES = [
  { type: "Cornerstone guide", title: (keyword: string) => `The complete guide to ${keyword}` },
  { type: "FAQ article", title: (keyword: string) => `${keyword}: the questions customers ask first` },
  { type: "Decision checklist", title: (keyword: string) => `A practical ${keyword} checklist` },
  { type: "Comparison page", title: (keyword: string) => `${keyword}: options, tradeoffs, and who each is for` },
  { type: "Expert guide", title: (keyword: string) => `The most common ${keyword} mistakes and how to avoid them` },
  { type: "Case study", title: (keyword: string) => `How a customer approached ${keyword}` },
  { type: "Buyer guide", title: (keyword: string) => `How to evaluate ${keyword} before you decide` },
  { type: "Implementation plan", title: (keyword: string) => `A step-by-step plan for ${keyword}` },
  { type: "Cost guide", title: (keyword: string) => `${keyword}: costs, effort, and expected value` },
  { type: "Timeline guide", title: (keyword: string) => `How long ${keyword} takes and what happens next` },
  { type: "Examples article", title: (keyword: string) => `${keyword}: real examples and useful patterns` },
  { type: "Strategy article", title: (keyword: string) => `A focused strategy for ${keyword}` },
  { type: "Evaluation guide", title: (keyword: string) => `The criteria that matter most for ${keyword}` },
  { type: "Alternatives page", title: (keyword: string) => `${keyword}: alternatives worth considering` },
  { type: "Framework article", title: (keyword: string) => `A simple framework for ${keyword}` },
  { type: "Benchmark report", title: (keyword: string) => `${keyword}: benchmarks and signals to watch` },
  { type: "Toolkit", title: (keyword: string) => `The ${keyword} planning toolkit` },
  { type: "FAQ refresh", title: (keyword: string) => `More answers to common ${keyword} questions` },
  { type: "Expert interview", title: (keyword: string) => `An expert perspective on ${keyword}` },
  { type: "Glossary", title: (keyword: string) => `${keyword}: terms and concepts explained plainly` },
  { type: "Myth-busting article", title: (keyword: string) => `${keyword}: myths, facts, and better decisions` },
  { type: "Market guide", title: (keyword: string) => `${keyword}: what changes by market or customer` },
  { type: "Trend analysis", title: (keyword: string) => `What is changing in ${keyword}` },
  { type: "Content refresh", title: (keyword: string) => `${keyword}: the six-month update` },
] as const;

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
      type: angle.type,
      title: angle.title(keyword.keyword),
      focusKeyword: keyword.keyword,
      intent: keyword.intent || "informational",
      evidence,
      searchVolume: Number(keyword.searchVolume ?? 0),
      difficulty: Number(keyword.difficulty ?? 0),
      status: index < 4 ? "Review draft" : "Planned",
    };
  });
}
