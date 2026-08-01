export type AuditSource = "demo" | "dataforseo";

export type SeoAuditRequest = {
  website: string;
  locationName?: string;
  businessContext?: {
    productsServices?: string;
    idealCustomer?: string;
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
