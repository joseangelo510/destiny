import { buildLinePath, historyMonthLabel, latestHistoryPoints, type HistoricalSeoPoint } from "@/lib/analytics/history";

export function SeoHistoryChart({
  points,
  metric,
  title,
  description,
}: {
  points: HistoricalSeoPoint[];
  metric: "organicTraffic" | "rankingKeywords";
  title: string;
  description: string;
}) {
  const history = latestHistoryPoints(points, 3);
  const values = history.map((point) => point[metric]);
  const path = buildLinePath(values, 600, 220);
  const latest = values.at(-1) ?? 0;
  const first = values[0] ?? 0;
  const change = first > 0 ? Math.round(((latest - first) / first) * 100) : null;

  return <article className="workspace-card seo-history-chart">
    <div className="history-chart-heading"><div><span className="eyebrow">Last 3 months</span><h2>{title}</h2><p>{description}</p></div><div><strong>{latest.toLocaleString()}</strong><small>{change === null ? "Baseline established" : `${change >= 0 ? "+" : ""}${change}% over the period`}</small></div></div>
    <div className="history-chart-plot">
      <svg aria-label={`${title} for the last three months`} preserveAspectRatio="none" role="img" viewBox="0 0 600 220">
        <line x1="12" x2="588" y1="60" y2="60" />
        <line x1="12" x2="588" y1="120" y2="120" />
        <line x1="12" x2="588" y1="180" y2="180" />
        <path d={path} />
        {history.map((point, index) => {
          const x = history.length === 1 ? 300 : 12 + (index / (history.length - 1)) * 576;
          const maximum = Math.max(...values);
          const minimum = Math.min(...values);
          const y = maximum === minimum ? 110 : 12 + ((maximum - values[index]) / (maximum - minimum)) * 196;
          return <circle cx={x} cy={y} key={`${point.year}-${point.month}`} r="6" />;
        })}
      </svg>
      <div className="history-chart-labels">{history.map((point) => <span key={`${point.year}-${point.month}`}><b>{historyMonthLabel(point)}</b><small>{Number(point[metric]).toLocaleString()}</small></span>)}</div>
    </div>
    <small className="history-source">Source: DataForSEO Historical Rank Overview. Destiny renders the returned monthly metrics directly; no AI-generated chart image is used.</small>
  </article>;
}
