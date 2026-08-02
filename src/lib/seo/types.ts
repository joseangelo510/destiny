export type AuditSource = "demo" | "dataforseo";

export type SeoAuditRequest = {
  website: string;
  locationName?: string;
  businessContext?: {
    productsServices?: string;
    problemSolved?: string;
    idealCustomer?: string;
    audienceChallengesGoals?: string;
    market?: string;
  };
};

export type SeoIssue = {
  code: string;
  label: string;
  severity: "critical" | "warning";
};

export type SeoCompetitor = {
  domain: string;
  sharedKeywords: number;
};

export type SeoKeyword = {
  keyword: string;
  rank: number;
  searchVolume: number;
  url: string;
  intent: string;
  difficulty: number;
  cpc: number;
  opportunity: "existing_rank" | "competitor_gap" | "site_idea";
  normalizedKeyword?: string;
  matchedTerms?: string[];
  competitorRankers?: number;
  verdict?: "accept" | "review" | "reject";
  ruleId?: string;
  reason?: string;
  essential?: boolean;
};

export type SeoSitePage = {
  url: string;
  role: "homepage" | "product" | "how_it_works" | "about" | "contact" | "other";
  title?: string;
  text: string;
};

export type SeoSiteVocabularyTerm = {
  term: string;
  normalized: string;
  weight: number;
  sourcePages: string[];
  evidence: string;
};

export type SeoDistributionOpportunity = {
  platform: "Reddit" | "Quora";
  topic: string;
  title: string;
  url: string;
  snippet: string;
  checkedAt: string;
};

export type SeoLlmVisibility = {
  status: "available" | "unavailable";
  totalMentions: number;
  aiSearchVolume: number;
  platforms: Array<{ platform: string; mentions: number; aiSearchVolume: number }>;
  topCitedDomains: Array<{ company: string; domain: string; website: string; mentions: number; aiSearchVolume: number }>;
  reason?: string;
};

export type SeoAuditMetrics = {
  criticalIssues: number;
  warnings: number;
  rankingKeywords: number;
  newKeywords: number;
  lostKeywords: number;
  estimatedOrganicTraffic: number;
  contentGaps: number;
  reviewCount: number;
  onPageScore: number | null;
};

export type SeoAuditResult = {
  source: AuditSource;
  sourceLabel: string;
  domain: string;
  fetchedAt: string;
  metrics: SeoAuditMetrics;
  issues: SeoIssue[];
  competitors: SeoCompetitor[];
  keywords: SeoKeyword[];
  pages?: SeoSitePage[];
  siteVocabulary?: SeoSiteVocabularyTerm[];
  distributionOpportunities?: SeoDistributionOpportunity[];
  llmVisibility?: SeoLlmVisibility;
  notices: string[];
};

export type PersistedSeoAuditResult = SeoAuditResult & {
  auditId: string;
  growthStage: string;
  weeklyQuest: string;
  resultsPath: string;
  emailDelivery?: {
    status: "sent" | "skipped" | "failed";
    messageId?: string;
    reason?: string;
  };
};

export interface SeoProvider {
  runAudit(input: SeoAuditRequest): Promise<SeoAuditResult>;
}
