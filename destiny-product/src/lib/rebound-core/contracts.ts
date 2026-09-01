export type LoadState = "loading" | "ready" | "empty" | "not_connected" | "error";

export type EvidenceKind = "verified" | "reported";
export type EvidenceSource = "gsc" | "ga4" | "crawl" | "cms" | "quest" | "schedule";

export type Evidence = {
  kind: EvidenceKind;
  source: EvidenceSource;
  observedAt: string | null;
  detail: string;
};

export type PanelResult<T> = {
  state: LoadState;
  data: T | null;
  evidence: Evidence[];
  message: string | null;
};

export type CoreMove = {
  id: string;
  title: string;
  description: string;
  href: string;
  why: string;
  estimateMinutes: number | null;
  state: "draft" | "ready" | "reported" | "open";
};

export type CoreQueue = {
  items: CoreMove[];
  sessionMoves: CoreMove[];
};

export type SearchConsoleSummary = {
  impressions: number | null;
  impressionsChange: number | null;
  clicks: number | null;
  clicksChange: number | null;
  averagePosition: number | null;
  previousAveragePosition: number | null;
  series: Array<{ date: string; value: number }>;
  syncedAt: string | null;
};

export type AnalyticsSummary = {
  engagedVisits: number | null;
  engagedVisitsChange: number | null;
  syncedAt: string | null;
};

export type KeywordMover = {
  keyword: string;
  position: number | null;
  previousPosition: number | null;
  delta: number | null;
  tone: "up" | "down" | "flat" | "new";
};

export type KeywordSummary = {
  tracked: number;
  newlyFound: number;
  improved: number;
  declined: number;
  lost: number;
  buckets: Array<{ label: string; count: number }>;
  rising: KeywordMover[];
  declining: KeywordMover[];
  lostItems: KeywordMover[];
};

export type CompetitorSummary = {
  websiteLabel: string;
  competitors: Array<{ name: string; url: string | null }>;
};

export type CalendarEvent = {
  id: string;
  date: string;
  title: string;
  tone: "move" | "automatic" | "verified";
  state: string;
};

export type CalendarSummary = {
  month: string;
  anchorDate?: string;
  events: CalendarEvent[];
};

export type ReboundHomeView = {
  firstName: string | null;
  websiteLabel: string;
  websiteId: string;
  queue: PanelResult<CoreQueue>;
  searchConsole: PanelResult<SearchConsoleSummary>;
  analytics: PanelResult<AnalyticsSummary>;
  keywords: PanelResult<KeywordSummary>;
  competitors: PanelResult<CompetitorSummary>;
  calendar: PanelResult<CalendarSummary>;
};

export type ReboundCoreWorkspace = {
  firstName: string | null;
  websiteLabel: string;
  websiteId: string;
  queue: PanelResult<CoreQueue>;
  searchConnected: boolean;
};
