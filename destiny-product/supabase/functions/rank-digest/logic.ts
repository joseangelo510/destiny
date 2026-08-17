export type RankingDigestFrequency = "three_day" | "weekly" | "off";

export type RankDigestReading = {
  keyword: string;
  currentFound: boolean;
  currentPosition: number | null;
  previousFound: boolean | null;
  previousPosition: number | null;
  searchVolume?: number | null;
};

export type RankDigestOpportunity = {
  keyword: string;
  estimatedVolume: number;
  intent: "transactional" | "commercial" | "navigational" | "informational";
  difficulty: number | null;
  priorityScore: number;
  reason: string;
  evidenceSource: "site_audit" | "serp_scan" | "competitor_gap";
};

export type RankDigestRow = RankDigestReading & {
  change: number | null;
  direction: "up" | "down" | "steady" | "baseline";
  enteredTop10: boolean;
  leftTop10: boolean;
  milestone: "hit_1" | "entered_top_3" | "entered_top_10" | "entered_top_100" | "none";
};

function validPosition(found: boolean | null, position: number | null) {
  return found === true && Number.isInteger(position) && Number(position) > 0 ? Number(position) : null;
}

export function movementFor(reading: RankDigestReading): RankDigestRow {
  const current = validPosition(reading.currentFound, reading.currentPosition);
  const previous = validPosition(reading.previousFound, reading.previousPosition);
  const milestone = current === 1 && previous !== 1
    ? "hit_1"
    : current !== null && current <= 3 && (previous === null || previous > 3)
      ? "entered_top_3"
      : current !== null && current <= 10 && (previous === null || previous > 10)
        ? "entered_top_10"
        : current !== null && previous === null
          ? "entered_top_100"
          : "none";
  if (reading.previousFound === null) return { ...reading, change: null, direction: "baseline", enteredTop10: false, leftTop10: false, milestone };
  if (current !== null && previous === null) {
    return { ...reading, change: null, direction: "up", enteredTop10: current <= 10, leftTop10: false, milestone };
  }
  if (current === null && previous !== null) {
    return { ...reading, change: null, direction: "down", enteredTop10: false, leftTop10: previous <= 10, milestone };
  }
  if (current === null || previous === null) {
    return { ...reading, change: null, direction: "steady", enteredTop10: false, leftTop10: false, milestone };
  }
  const change = previous - current;
  return {
    ...reading,
    change,
    direction: change > 0 ? "up" : change < 0 ? "down" : "steady",
    enteredTop10: previous > 10 && current <= 10,
    leftTop10: previous <= 10 && current > 10,
    milestone,
  };
}

function estimatedCtr(position: number) {
  if (position === 1) return 0.28;
  if (position === 2) return 0.15;
  if (position === 3) return 0.11;
  if (position <= 5) return 0.07;
  if (position <= 10) return 0.035;
  if (position <= 20) return 0.012;
  if (position <= 50) return 0.003;
  return 0.001;
}

function normalizedKeyword(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

export function selectDigestOpportunities(candidates: RankDigestOpportunity[], excludedKeywords: string[], limit = 10) {
  const excluded = new Set(excludedKeywords.map(normalizedKeyword));
  const seen = new Set<string>();
  const intentWeight = { transactional: 4, commercial: 3, navigational: 2, informational: 1 };
  return candidates
    .filter((candidate) => candidate.keyword.trim() && candidate.estimatedVolume > 0 && !excluded.has(normalizedKeyword(candidate.keyword)))
    .filter((candidate) => {
      const normalized = normalizedKeyword(candidate.keyword);
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .sort((left, right) =>
      right.priorityScore - left.priorityScore
      || intentWeight[right.intent] - intentWeight[left.intent]
      || (left.difficulty ?? 101) - (right.difficulty ?? 101)
      || right.estimatedVolume - left.estimatedVolume
      || left.keyword.localeCompare(right.keyword))
    .slice(0, Math.max(0, limit));
}

export function buildRankDigest(siteName: string, readings: RankDigestReading[]) {
  const rows = readings.map(movementFor).sort((left, right) => {
    const magnitude = (row: RankDigestRow) => row.change === null
      ? row.direction === "steady" || row.direction === "baseline" ? 0 : 101
      : Math.abs(row.change);
    return magnitude(right) - magnitude(left) || left.keyword.localeCompare(right.keyword);
  });
  const comparisonRows = rows.filter((row) => row.direction !== "baseline");
  const up = comparisonRows.filter((row) => row.direction === "up").length;
  const down = comparisonRows.filter((row) => row.direction === "down").length;
  const steady = comparisonRows.filter((row) => row.direction === "steady").length;
  const currentPositions = rows.flatMap((row) => validPosition(row.currentFound, row.currentPosition) ?? []);
  const previousPositions = rows.flatMap((row) => validPosition(row.previousFound, row.previousPosition) ?? []);
  const hasComparison = comparisonRows.length > 0;
  const measuredRows = rows.filter((row) => row.currentFound && validPosition(row.currentFound, row.currentPosition) !== null);
  const rowsWithVolume = measuredRows.filter((row) => Number(row.searchVolume ?? 0) > 0);
  const totalTrackedVolume = rowsWithVolume.reduce((sum, row) => sum + Number(row.searchVolume), 0);
  const estimatedMonthlyVisits = rowsWithVolume.length
    ? rowsWithVolume.reduce((sum, row) => sum + Number(row.searchVolume) * estimatedCtr(Number(row.currentPosition)), 0)
    : null;
  const visibilityPercent = estimatedMonthlyVisits !== null && totalTrackedVolume > 0
    ? Number(((estimatedMonthlyVisits / totalTrackedVolume) * 100).toFixed(2))
    : null;
  const milestoneCount = rows.filter((row) => row.milestone !== "none").length;
  const topTracked = [...rows].sort((left, right) => {
    const milestoneWeight = { hit_1: 4, entered_top_3: 3, entered_top_10: 2, entered_top_100: 1, none: 0 };
    const leftPosition = validPosition(left.currentFound, left.currentPosition) ?? 999;
    const rightPosition = validPosition(right.currentFound, right.currentPosition) ?? 999;
    return milestoneWeight[right.milestone] - milestoneWeight[left.milestone]
      || Math.abs(right.change ?? 0) - Math.abs(left.change ?? 0)
      || leftPosition - rightPosition
      || left.keyword.localeCompare(right.keyword);
  }).slice(0, 10);
  return {
    siteName,
    rows,
    topMovers: rows.filter((row) => row.direction !== "steady").slice(0, 10),
    topTracked,
    counts: {
      up,
      down,
      steady,
      enteredTop10: rows.filter((row) => row.enteredTop10).length,
      leftTop10: rows.filter((row) => row.leftTop10).length,
    },
    hasComparison,
    subject: !rows.length
      ? `${siteName}: your search visibility starting point`
      : !hasComparison
        ? `${siteName}: your first ranking baseline`
        : rows.some((row) => row.milestone === "hit_1")
          ? `${siteName}: a keyword reached #1`
          : rows.some((row) => row.enteredTop10)
            ? `${siteName}: ${rows.filter((row) => row.enteredTop10).length} keyword${rows.filter((row) => row.enteredTop10).length === 1 ? "" : "s"} reached page 1`
            : up
              ? `${siteName}: ${up} keyword${up === 1 ? "" : "s"} moved up`
              : down
                ? `${siteName}: ${down} keyword${down === 1 ? "" : "s"} moved down`
                : `${siteName}: rankings holding steady`,
    averageCurrent: currentPositions.length ? Math.round(currentPositions.reduce((sum, value) => sum + value, 0) / currentPositions.length) : null,
    averagePrevious: previousPositions.length ? Math.round(previousPositions.reduce((sum, value) => sum + value, 0) / previousPositions.length) : null,
    top10Current: currentPositions.filter((position) => position <= 10).length,
    top10Previous: previousPositions.filter((position) => position <= 10).length,
    distribution: {
      top3: currentPositions.filter((position) => position <= 3).length,
      top10: currentPositions.filter((position) => position <= 10).length,
      top20: currentPositions.filter((position) => position <= 20).length,
      top100: currentPositions.filter((position) => position <= 100).length,
      notYetVisible: rows.filter((row) => !row.currentFound).length,
    },
    milestoneCount,
    visibilityPercent,
    estimatedMonthlyVisits: estimatedMonthlyVisits === null ? null : Number(estimatedMonthlyVisits.toFixed(1)),
    totalTrackedVolume,
  };
}

export function nextDigestAt(sentAt: Date, frequency: Exclude<RankingDigestFrequency, "off">) {
  return new Date(sentAt.getTime() + (frequency === "three_day" ? 3 : 7) * 86_400_000);
}

export function shouldSendDigest(lastSentAt: string | null, latestObservationAt: string | null) {
  if (!latestObservationAt) return false;
  if (!lastSentAt) return true;
  return new Date(latestObservationAt).getTime() > new Date(lastSentAt).getTime();
}
