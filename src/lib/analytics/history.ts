export type HistoricalSeoPoint = {
  year: number;
  month: number;
  organicTraffic: number;
  rankingKeywords: number;
  top3Keywords?: number;
  top10Keywords?: number;
  newKeywords?: number;
  lostKeywords?: number;
};

export function latestHistoryPoints(points: HistoricalSeoPoint[], limit = 3) {
  return [...points]
    .filter((point) => Number.isInteger(point.year) && point.year > 2000 && Number.isInteger(point.month) && point.month >= 1 && point.month <= 12)
    .sort((left, right) => (left.year * 12 + left.month) - (right.year * 12 + right.month))
    .slice(-Math.max(1, limit));
}

export function buildLinePath(values: number[], width = 600, height = 220) {
  if (!values.length) return "";
  const padding = 12;
  const usableWidth = Math.max(0, width - padding * 2);
  const usableHeight = Math.max(0, height - padding * 2);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = maximum - minimum;
  return values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : padding + (index / (values.length - 1)) * usableWidth;
    const y = range === 0 ? height / 2 : padding + ((maximum - value) / range) * usableHeight;
    return `${index === 0 ? "M" : "L"} ${Number(x.toFixed(2))} ${Number(y.toFixed(2))}`;
  }).join(" ");
}

export function historyMonthLabel(point: Pick<HistoricalSeoPoint, "year" | "month">) {
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(point.year, point.month - 1, 1)));
}

export function formatHistoricalCount(value: number) {
  if (!Number.isFinite(value)) return "—";
  return Math.round(value).toLocaleString("en-US");
}
