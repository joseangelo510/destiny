import type { HistoricalSeoPoint } from "./history";

export type AnalyticsRange = 30 | 90;
export type AnalyticsMetricKey = "impressions" | "clicks" | "engagedVisits";

export type AnalyticsSeriesPoint = {
  date: string;
  value: number;
};

export type AnalyticsMetric = {
  key: AnalyticsMetricKey;
  name: string;
  total: number | null;
  previousTotal: number | null;
  changePercent: number | null;
  source: string;
  detail: string;
  current: AnalyticsSeriesPoint[];
  previous: AnalyticsSeriesPoint[];
};

export type AnalyticsTrafficSource = {
  label: string;
  sessions: number;
  percent: number;
};

export type RankObservationInput = {
  tracked_keyword_id: string;
  observed_at: string;
  found: boolean;
  position: number | null;
};

export type TrackedKeywordInput = {
  id: string;
  keyword: string;
};

export type AnalyticsRankMover = {
  keyword: string;
  currentPosition: number | null;
  previousPosition: number | null;
  delta: number | null;
  tone: "up" | "down" | "flat" | "new";
};

export type AnalyticsVerdictSegment = {
  text: string;
  highlight?: boolean;
};

export type AnalyticsPeriodView = {
  range: AnalyticsRange;
  metrics: Record<AnalyticsMetricKey, AnalyticsMetric>;
  trafficSources: AnalyticsTrafficSource[];
  verdict: string;
  verdictSegments: AnalyticsVerdictSegment[];
  why: string;
  hasFirstPartyTrend: boolean;
};

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function nonNegative(value: unknown): number | null {
  const parsed = finiteNumber(value);
  return parsed === null ? null : Math.max(0, parsed);
}

function percentChange(current: number | null, previous: number | null) {
  if (current === null || previous === null || previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function normalizedSeries(value: unknown, key: string) {
  return list(value).flatMap((item) => {
    const row = record(item);
    const date = typeof row.date === "string" ? row.date : "";
    const amount = nonNegative(row[key]);
    return date && amount !== null ? [{ date, value: amount }] : [];
  });
}

function sourceLabel(source: string, medium: string) {
  const value = `${source} ${medium}`.toLocaleLowerCase("en-US");
  if (/chatgpt|openai|perplexity|claude|anthropic|gemini|copilot|you\.com|poe/.test(value)) return "AI assistants";
  if (source === "(direct)" || medium === "(none)" || medium === "(not set)") return "Direct";
  if (medium === "organic" || /google|bing|duckduckgo|yahoo|ecosia/.test(value)) return "Organic search";
  if (/social|facebook|linkedin|instagram|reddit|twitter|t\.co|youtube|pinterest|threads/.test(value)) return "Social";
  return "Referrals";
}

function trafficSources(period: JsonRecord) {
  const totals = new Map<string, number>();
  for (const item of list(period.trafficSources)) {
    const row = record(item);
    const sessions = nonNegative(row.sessions) ?? 0;
    if (sessions <= 0) continue;
    const label = sourceLabel(String(row.source ?? ""), String(row.medium ?? ""));
    totals.set(label, (totals.get(label) ?? 0) + sessions);
  }
  const total = [...totals.values()].reduce((sum, value) => sum + value, 0);
  return [...totals.entries()]
    .map(([label, sessions]) => ({ label, sessions, percent: total > 0 ? Math.round((sessions / total) * 100) : 0 }))
    .sort((left, right) => right.sessions - left.sessions || left.label.localeCompare(right.label));
}

function legacySearchPeriod(metadata: JsonRecord, range: AnalyticsRange) {
  if (range !== 30) return {};
  const clicks = nonNegative(metadata.clicks);
  const impressions = nonNegative(metadata.impressions);
  return clicks === null && impressions === null ? {} : {
    clicks,
    impressions,
    startDate: metadata.startDate,
    endDate: metadata.endDate,
  };
}

function legacyAnalyticsPeriod(metadata: JsonRecord, range: AnalyticsRange) {
  if (range !== 30) return {};
  const organicSessions = nonNegative(metadata.organicSessions);
  const organicEngagedSessions = nonNegative(metadata.organicEngagedSessions);
  return organicSessions === null && organicEngagedSessions === null ? {} : {
    organicSessions,
    organicEngagedSessions,
    organicActiveUsers: nonNegative(metadata.organicActiveUsers),
    organicKeyEvents: nonNegative(metadata.organicKeyEvents),
  };
}

function selectedPeriod(metadata: JsonRecord | null, range: AnalyticsRange, legacy: (metadata: JsonRecord, range: AnalyticsRange) => JsonRecord) {
  if (!metadata) return {};
  const periods = record(metadata.periods);
  const selected = record(periods[String(range)]);
  return Object.keys(selected).length ? selected : legacy(metadata, range);
}

function metric(input: {
  key: AnalyticsMetricKey;
  name: string;
  total: number | null;
  previousTotal: number | null;
  source: string;
  detail: string;
  current: AnalyticsSeriesPoint[];
  previous: AnalyticsSeriesPoint[];
}): AnalyticsMetric {
  return { ...input, changePercent: percentChange(input.total, input.previousTotal) };
}

function signedPercent(value: number) {
  return `${value >= 0 ? "+" : "−"}${Math.abs(value)}%`;
}

function visibilityVerdict(metrics: Record<AnalyticsMetricKey, AnalyticsMetric>, movers: AnalyticsRankMover[]) {
  const impressions = metrics.impressions;
  const clicks = metrics.clicks;
  const rising = movers.filter((mover) => mover.tone === "up").length;
  const pageOne = movers.filter((mover) => mover.tone === "up"
    && mover.currentPosition !== null
    && mover.currentPosition <= 10
    && mover.previousPosition !== null
    && mover.previousPosition > 10).length;
  let segments: AnalyticsVerdictSegment[];
  if (impressions.total !== null && clicks.total !== null) {
    if (impressions.changePercent !== null && clicks.changePercent !== null) {
      if (impressions.changePercent > 0 && clicks.changePercent > 0) {
        segments = [
          { text: "More people are finding you on Google — visibility grew " },
          { text: signedPercent(impressions.changePercent), highlight: true },
          { text: " and search visits grew " },
          { text: signedPercent(clicks.changePercent), highlight: true },
        ];
      } else {
        segments = [
          { text: `Your Google visibility ${impressions.changePercent >= 0 ? "grew" : "fell"} ` },
          { text: signedPercent(impressions.changePercent), highlight: true },
          { text: `, while search visits ${clicks.changePercent >= 0 ? "grew" : "fell"} ` },
          { text: signedPercent(clicks.changePercent), highlight: true },
        ];
      }
      if (pageOne > 0) {
        segments.push(
          { text: ", with " },
          { text: `${pageOne} tracked keyword${pageOne === 1 ? "" : "s"}`, highlight: true },
          { text: " that moved onto page one" },
        );
      } else if (rising > 0) {
        segments.push(
          { text: ", with " },
          { text: `${rising} tracked keyword${rising === 1 ? "" : "s"}`, highlight: true },
          { text: " moving up" },
        );
      }
      segments.push({ text: "." });
      return { text: segments.map((segment) => segment.text).join(""), segments };
    }
    if (impressions.changePercent !== null || clicks.changePercent !== null) {
      const known = impressions.changePercent !== null
        ? { label: "visibility", metric: impressions }
        : { label: "search visits", metric: clicks };
      const change = known.metric.changePercent!;
      segments = [
        { text: `Your Google ${known.label} ${change >= 0 ? "grew" : "fell"} ` },
        { text: signedPercent(change), highlight: true },
        { text: ", while the other search metric established a new baseline." },
      ];
      return { text: segments.map((segment) => segment.text).join(""), segments };
    }
    segments = [{ text: `Google showed your site ${Math.round(impressions.total).toLocaleString("en-US")} times and sent ${Math.round(clicks.total).toLocaleString("en-US")} search visit${Math.round(clicks.total) === 1 ? "" : "s"} during this connected period.` }];
    return { text: segments[0].text, segments };
  }
  if (impressions.total !== null) {
    segments = [{ text: `Your website appeared ${Math.round(impressions.total).toLocaleString("en-US")} times in Google Search during this connected period.` }];
    return { text: segments[0].text, segments };
  }
  segments = [{ text: "Connect Google Search Console to see how often people find your website and which searches bring them in." }];
  return { text: segments[0].text, segments };
}

export function buildAnalyticsPeriods({
  searchConsole,
  analytics,
  movers = [],
}: {
  searchConsole: JsonRecord | null;
  analytics: JsonRecord | null;
  movers?: AnalyticsRankMover[];
}): Record<AnalyticsRange, AnalyticsPeriodView> {
  const build = (range: AnalyticsRange): AnalyticsPeriodView => {
    const search = selectedPeriod(searchConsole, range, legacySearchPeriod);
    const ga = selectedPeriod(analytics, range, legacyAnalyticsPeriod);
    const engagedValue = nonNegative(ga.organicEngagedSessions);
    const sessionsValue = nonNegative(ga.organicSessions);
    const engagedName = engagedValue === null ? "Organic visits" : "Engaged visits";
    const metrics = {
      impressions: metric({
        key: "impressions",
        name: "Seen on Google",
        total: nonNegative(search.impressions),
        previousTotal: nonNegative(search.previousImpressions),
        source: "Google Search Console",
        detail: "Search impressions",
        current: normalizedSeries(search.daily, "impressions"),
        previous: normalizedSeries(search.previousDaily, "impressions"),
      }),
      clicks: metric({
        key: "clicks",
        name: "Visited from search",
        total: nonNegative(search.clicks),
        previousTotal: nonNegative(search.previousClicks),
        source: "Google Search Console",
        detail: "Search clicks",
        current: normalizedSeries(search.daily, "clicks"),
        previous: normalizedSeries(search.previousDaily, "clicks"),
      }),
      engagedVisits: metric({
        key: "engagedVisits",
        name: engagedName,
        total: engagedValue ?? sessionsValue,
        previousTotal: engagedValue === null ? nonNegative(ga.previousOrganicSessions) : nonNegative(ga.previousOrganicEngagedSessions),
        source: "Google Analytics",
        detail: engagedValue === null ? "Organic sessions" : "Organic engaged sessions",
        current: normalizedSeries(ga.daily, engagedValue === null ? "organicSessions" : "organicEngagedSessions"),
        previous: normalizedSeries(ga.previousDaily, engagedValue === null ? "organicSessions" : "organicEngagedSessions"),
      }),
    } satisfies Record<AnalyticsMetricKey, AnalyticsMetric>;
    const verdict = visibilityVerdict(metrics, movers);
    return {
      range,
      metrics,
      trafficSources: trafficSources(ga),
      verdict: verdict.text,
      verdictSegments: verdict.segments,
      why: "Why it matters: impressions show discovery, clicks show visits, and Analytics shows whether organic visitors stayed and acted.",
      hasFirstPartyTrend: Object.values(metrics).some((item) => item.current.length > 1),
    };
  };
  return { 30: build(30), 90: build(90) };
}

export function buildRankMovers(tracked: TrackedKeywordInput[], observations: RankObservationInput[], limit = 5): AnalyticsRankMover[] {
  const byKeyword = new Map<string, RankObservationInput[]>();
  for (const observation of [...observations].sort((left, right) => right.observed_at.localeCompare(left.observed_at))) {
    const values = byKeyword.get(observation.tracked_keyword_id) ?? [];
    if (values.length < 2) byKeyword.set(observation.tracked_keyword_id, [...values, observation]);
  }
  const movers = tracked.flatMap((keyword) => {
    const [latest, previous] = byKeyword.get(keyword.id) ?? [];
    if (!latest) return [];
    const currentPosition = latest.found ? latest.position : null;
    const previousPosition = previous?.found ? previous.position : null;
    if (currentPosition === null && previousPosition === null) return [];
    const delta = currentPosition !== null && previousPosition !== null ? previousPosition - currentPosition : null;
    const tone = previous === undefined || previousPosition === null
      ? "new" as const
      : currentPosition === null
        ? "down" as const
        : delta === 0
          ? "flat" as const
          : delta !== null && delta > 0 ? "up" as const : "down" as const;
    return [{ keyword: keyword.keyword, currentPosition, previousPosition, delta, tone }];
  });
  return movers
    .sort((left, right) => {
      const toneOrder = { up: 0, new: 1, flat: 2, down: 3 };
      return toneOrder[left.tone] - toneOrder[right.tone]
        || Math.abs(right.delta ?? 0) - Math.abs(left.delta ?? 0)
        || left.keyword.localeCompare(right.keyword);
    })
    .slice(0, Math.max(0, limit));
}

export function rankingEstimateFallback(points: HistoricalSeoPoint[]) {
  const latest = [...points].sort((left, right) => (right.year * 12 + right.month) - (left.year * 12 + left.month))[0];
  return latest ? {
    organicTraffic: Math.max(0, latest.organicTraffic),
    rankingKeywords: Math.max(0, latest.rankingKeywords),
  } : null;
}
