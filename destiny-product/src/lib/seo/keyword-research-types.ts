export type SearchIntent = "informational" | "commercial" | "transactional" | "navigational" | "unknown";

export type KeywordPageType = "homepage" | "blog_post" | "service_page" | "product_page" | "category_page" | "video" | "tool_or_app" | "other";

export type KeywordSerpSnapshot = {
  keyword: string;
  location: string;
  checkedAt: string;
  organic: Array<{ position: number; domain: string; title: string; url: string; pageType: KeywordPageType }>;
  questions: string[];
  related: string[];
};

export type KeywordResearchRow = {
  keyword: string;
  intent: SearchIntent;
  volume: number | null;
  difficulty: number | null;
  cpc: number | null;
  competition: number | null;
  trend: number[];
  position: number;
  traffic: number | null;
  url: string;
};
