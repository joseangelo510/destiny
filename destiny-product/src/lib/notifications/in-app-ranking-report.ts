import { isFreshReading, summarizeRankingMovements, type RankingDigestSummary } from "./ranking-digest";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type InAppRankingReportReading = {
  keyword: string;
  currentPosition: number | null;
  currentFound: boolean;
  previousPosition: number | null;
  previousFound: boolean | null;
  observedAt: string | null;
};

export type InAppRankingReport = {
  state: "ready" | "waiting_for_fresh_readings";
  periodStart: string;
  evidenceAt: string | null;
  summary: RankingDigestSummary;
  topRanked: Array<{ keyword: string; position: number }>;
  notVisible: string[];
};

const EMPTY_SUMMARY: RankingDigestSummary = {
  keywordsCompared: 0,
  movedUp: 0,
  movedDown: 0,
  steady: 0,
  baselines: [],
  enteredTop10: 0,
  leftTop10: 0,
  topMovers: [],
};

export function buildInAppRankingReport(
  readings: InAppRankingReportReading[],
  nowIso: string,
): InAppRankingReport {
  const now = Date.parse(nowIso);
  const periodStart = Number.isFinite(now)
    ? new Date(now - WEEK_MS).toISOString()
    : nowIso;
  const fresh = readings.filter((reading) => isFreshReading(reading.observedAt, periodStart));
  if (!fresh.length) {
    return {
      state: "waiting_for_fresh_readings",
      periodStart,
      evidenceAt: null,
      summary: EMPTY_SUMMARY,
      topRanked: [],
      notVisible: [],
    };
  }

  const summary = summarizeRankingMovements(fresh.map((reading) => ({
    keyword: reading.keyword,
    currentPosition: reading.currentFound && Number(reading.currentPosition) > 0 ? reading.currentPosition : null,
    currentFound: reading.currentFound,
    previousPosition: reading.previousFound && Number(reading.previousPosition) > 0 ? reading.previousPosition : null,
    previousFound: reading.previousFound,
  })));
  const topRanked = fresh
    .filter((reading) => reading.currentFound && Number(reading.currentPosition) > 0)
    .map((reading) => ({ keyword: reading.keyword, position: Number(reading.currentPosition) }))
    .sort((left, right) => left.position - right.position || left.keyword.localeCompare(right.keyword))
    .slice(0, 10);
  const notVisible = fresh
    .filter((reading) => !reading.currentFound)
    .map((reading) => reading.keyword)
    .sort((left, right) => left.localeCompare(right));
  const evidenceAt = fresh
    .map((reading) => reading.observedAt)
    .filter((value): value is string => typeof value === "string" && Number.isFinite(Date.parse(value)))
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null;

  return { state: "ready", periodStart, evidenceAt, summary, topRanked, notVisible };
}
