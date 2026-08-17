export type RankingDigestFrequency = "three_day" | "weekly" | "off";

export type RankDigestReading = {
  keyword: string;
  currentFound: boolean;
  currentPosition: number | null;
  previousFound: boolean | null;
  previousPosition: number | null;
};

export type RankDigestRow = RankDigestReading & {
  change: number | null;
  direction: "up" | "down" | "steady" | "baseline";
  enteredTop10: boolean;
  leftTop10: boolean;
};

function validPosition(found: boolean | null, position: number | null) {
  return found === true && Number.isInteger(position) && Number(position) > 0 ? Number(position) : null;
}

export function movementFor(reading: RankDigestReading): RankDigestRow {
  const current = validPosition(reading.currentFound, reading.currentPosition);
  const previous = validPosition(reading.previousFound, reading.previousPosition);
  if (reading.previousFound === null) return { ...reading, change: null, direction: "baseline", enteredTop10: false, leftTop10: false };
  if (current !== null && previous === null) {
    return { ...reading, change: null, direction: "up", enteredTop10: current <= 10, leftTop10: false };
  }
  if (current === null && previous !== null) {
    return { ...reading, change: null, direction: "down", enteredTop10: false, leftTop10: previous <= 10 };
  }
  if (current === null || previous === null) {
    return { ...reading, change: null, direction: "steady", enteredTop10: false, leftTop10: false };
  }
  const change = previous - current;
  return {
    ...reading,
    change,
    direction: change > 0 ? "up" : change < 0 ? "down" : "steady",
    enteredTop10: previous > 10 && current <= 10,
    leftTop10: previous <= 10 && current > 10,
  };
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
  return {
    siteName,
    rows,
    topMovers: rows.filter((row) => row.direction !== "steady").slice(0, 10),
    counts: {
      up,
      down,
      steady,
      enteredTop10: rows.filter((row) => row.enteredTop10).length,
      leftTop10: rows.filter((row) => row.leftTop10).length,
    },
    hasComparison,
    subject: !hasComparison
      ? `${siteName}: your first ranking baseline`
      : up || down
        ? `${siteName}: ${up} up, ${down} down`
        : `${siteName}: rankings holding steady`,
    averageCurrent: currentPositions.length ? Math.round(currentPositions.reduce((sum, value) => sum + value, 0) / currentPositions.length) : null,
    averagePrevious: previousPositions.length ? Math.round(previousPositions.reduce((sum, value) => sum + value, 0) / previousPositions.length) : null,
    top10Current: currentPositions.filter((position) => position <= 10).length,
    top10Previous: previousPositions.filter((position) => position <= 10).length,
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
