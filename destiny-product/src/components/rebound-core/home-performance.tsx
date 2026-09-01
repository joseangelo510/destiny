import Link from "next/link";
import type { AnalyticsSummary, PanelResult, SearchConsoleSummary } from "@/lib/rebound-core/contracts";
import { EvidenceChip, Panel, PanelHeader } from "./primitives";
import styles from "./home-dashboard.module.css";

function value(value: number | null, decimals = 0) {
  return value === null ? "—" : value.toLocaleString("en-US", { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

function delta(value: number | null) {
  if (value === null) return "Baseline";
  return `${value >= 0 ? "+" : "−"}${Math.abs(value)}%`;
}

function chartPath(series: SearchConsoleSummary["series"]) {
  if (series.length < 2) return null;
  const values = series.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(1, max - min);
  const points = values.map((item, index) => {
    const x = (index / Math.max(1, values.length - 1)) * 640;
    const y = 108 - ((item - min) / spread) * 88;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `M${points.join(" L")}`;
}

function syncedLabel(value: string | null) {
  if (!value) return "Sync time unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sync time unavailable";
  return `Synced ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date)}`;
}

function SearchBox({ result }: { result: PanelResult<SearchConsoleSummary> }) {
  if (result.state !== "ready" || !result.data) return <div className={`${styles.sourceBox} ${styles.sourceBoxOff}`}><header><b>Search Console</b><EvidenceChip fallback={result.state === "not_connected" ? "Not connected" : "Waiting for data"} /></header><div className={styles.sourceEmpty}><p>{result.message}</p><Link href="/integrations">Open Connections</Link></div></div>;
  const data = result.data;
  const path = chartPath(data.series);
  return <div className={styles.sourceBox}><header><b>Search Console</b><EvidenceChip evidence={result.evidence[0]} /></header><div className={styles.sourceKpis}><div><strong>{value(data.impressions)}</strong><span>Impressions</span><small>{delta(data.impressionsChange)}</small></div><div><strong>{value(data.clicks)}</strong><span>Clicks</span><small>{delta(data.clicksChange)}</small></div><div><strong>{value(data.averagePosition, 1)}</strong><span>Avg position</span><small>{data.previousAveragePosition === null ? "Baseline" : `from ${value(data.previousAveragePosition, 1)}`}</small></div></div><div className={styles.chart}>{path ? <svg aria-label="Search impressions trend" role="img" viewBox="0 0 640 120"><path className={styles.chartArea} d={`${path} L640,114 L0,114 Z`} /><path className={styles.chartLine} d={path} /></svg> : <p>More synced days are needed for a trend line.</p>}<div><span>Impressions · current connected period</span><span>{syncedLabel(data.syncedAt)}</span></div></div></div>;
}

function AnalyticsBox({ result }: { result: PanelResult<AnalyticsSummary> }) {
  if (result.state === "ready" && result.data) return <div className={styles.sourceBox}><header><b>Analytics</b><EvidenceChip evidence={result.evidence[0]} /></header><div className={styles.analyticsReady}><strong>{value(result.data.engagedVisits)}</strong><span>Organic engaged visits</span><small>{delta(result.data.engagedVisitsChange)} · {syncedLabel(result.data.syncedAt)}</small></div></div>;
  return <div className={`${styles.sourceBox} ${styles.sourceBoxOff}`}><header><b>Analytics</b><EvidenceChip fallback={result.state === "not_connected" ? "Not connected" : "Waiting for data"} /></header><div className={styles.sourceEmpty}><p>{result.message}</p><Link href="/integrations">Open Connections</Link><small>Google Analytics · read-only connection status</small></div></div>;
}

export function HomePerformance({ analytics, searchConsole }: { analytics: PanelResult<AnalyticsSummary>; searchConsole: PanelResult<SearchConsoleSummary> }) {
  return <Panel className={`${styles.performance} ${styles.c7}`}><PanelHeader action="Full analytics" href="/analytics" title="How your SEO is doing" /><div className={styles.twoBox}><SearchBox result={searchConsole} /><AnalyticsBox result={analytics} /></div></Panel>;
}
