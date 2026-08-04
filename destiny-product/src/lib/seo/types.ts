export type AuditSource = "demo" | "dataforseo";

export type SeoAuditRequest = {
  website: string;
  locationName?: string;
  businessContext?: {
    businessName?: string;
    productsServices?: string;
    problemSolved?: string;
    idealCustomer?: string;
    audienceChallengesGoals?: string;
    differentiation?: string;
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
  directCompetitorRankers?: number;
  providerIntent?: "transactional" | "commercial" | "navigational" | "informational";
  searchIntent?: "conversion" | "consideration" | "awareness";
  businessFit?: number;
  revenueFit?: number;
  relevanceTier?: "core" | "adjacent";
  priorityTier?: 1 | 2 | 3 | 4;
  priorityScore?: number;
  priorityReason?: string;
  themeId?: string;
  themeLabel?: string;
  themeRole?: "conversion" | "consideration" | "awareness" | "technical_authority";
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

export type SeoPublisherOpportunity = {
  domain: string;
  title: string;
  url: string;
  snippet: string;
  keyword: string;
};

export type SeoLlmVisibility = {
  status: "available" | "unavailable";
  totalMentions: number;
  aiSearchVolume: number;
  platforms: Array<{ platform: string; mentions: number; aiSearchVolume: number }>;
  topCitedDomains: Array<{ company: string; domain: string; website: string; mentions: number; aiSearchVolume: number }>;
  reason?: string;
};

export type SeoBusinessSearchBrief = {
  source: "claude-opus-4-8" | "deterministic";
  model: string | null;
  businessSummary: string;
  offerVsEnablement: {
    whatCompanySells: string[];
    whatProductEnables: string[];
    notTheOffer: string[];
  };
  audiences: string[];
  problems: string[];
  differentiators: string[];
  themes: Array<{
    id: string;
    label: string;
    funnelRole: "conversion" | "consideration" | "awareness" | "technical_authority";
    priority: "primary" | "secondary" | "supporting";
    seedKeywords: string[];
    requiredTerms: string[];
    negativeTerms: string[];
    evidence: Array<{
      field: "productsServices" | "problemSolved" | "idealCustomer" | "audienceChallengesGoals" | "differentiation" | "market";
      quote: string;
    }>;
  }>;
  warning?: string;
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

export type SeoHistoricalPerformancePoint = {
  year: number;
  month: number;
  organicTraffic: number;
  rankingKeywords: number;
  top3Keywords: number;
  top10Keywords: number;
  newKeywords: number;
  lostKeywords: number;
};

export type SeoAuditResult = {
  source: AuditSource;
  sourceLabel: string;
  domain: string;
  fetchedAt: string;
  metrics: SeoAuditMetrics;
  historicalPerformance?: SeoHistoricalPerformancePoint[];
  issues: SeoIssue[];
  competitors: SeoCompetitor[];
  keywords: SeoKeyword[];
  pages?: SeoSitePage[];
  siteVocabulary?: SeoSiteVocabularyTerm[];
  distributionOpportunities?: SeoDistributionOpportunity[];
  publisherOpportunities?: SeoPublisherOpportunity[];
  llmVisibility?: SeoLlmVisibility;
  businessSearchBrief?: SeoBusinessSearchBrief;
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
