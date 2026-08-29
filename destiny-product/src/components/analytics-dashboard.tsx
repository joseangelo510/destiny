"use client";

import { useState } from "react";
import { WorkspaceLink as Link } from "@/components/workspace-link";
import type { AnalyticsMetric, AnalyticsMetricKey, AnalyticsPeriodView, AnalyticsRange, AnalyticsRankMover } from "@/lib/analytics/dashboard";

type SourceStatus = {
  label: string;
  detail: string;
  connected: boolean;
};

type NextAction = {
  title: string;
  href: string;
  label: string;
};

function formatValue(value: number | null) {
  return value === null ? "—" : Math.round(value).toLocaleString("en-US");
}

function changeLabel(metric: AnalyticsMetric, range: AnalyticsRange) {
  if (metric.total === null) return "Waiting for connected data";
  if (metric.changePercent === null) return "Connected baseline";
  if (metric.changePercent === 0) return `No change vs prior ${range} days`;
  return `${metric.changePercent > 0 ? "▲" : "▼"} ${Math.abs(metric.changePercent)}% vs prior ${range} days`;
}

function linePath(values: number[], width = 760, height = 230, domain?: { min: number; max: number }) {
  if (values.length < 2) return "";
  const padX = 10;
  const padTop = 14;
  const padBottom = 26;
  const min = domain?.min ?? Math.min(...values);
  const max = domain?.max ?? Math.max(...values);
  const range = Math.max(1, max - min);
  return values.map((value, index) => {
    const x = padX + (index / (values.length - 1)) * (width - padX * 2);
    const y = padTop + ((max - value) / range) * (height - padTop - padBottom);
    return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");
}

function hasPeriodData(period: AnalyticsPeriodView) {
  return Object.values(period.metrics).some((metric) => metric.total !== null);
}

function sparkPath(metric: AnalyticsMetric) {
  const values = metric.current.map((point) => point.value);
  return linePath(values, 120, 34);
}

function rankPosition(value: number | null) {
  return value === null ? "Not visible" : `#${Math.round(value)}`;
}

function movementLabel(mover: AnalyticsRankMover) {
  if (mover.tone === "new") return "New";
  if (mover.delta === null) return mover.tone === "down" ? "Lost" : "—";
  if (mover.delta === 0) return "— 0";
  return `${mover.delta > 0 ? "▲" : "▼"} ${Math.abs(mover.delta)}`;
}

export function AnalyticsDashboard({
  periods,
  rankMovers,
  trackedKeywordCount,
  sources,
  nextAction,
  estimate,
}: {
  periods: Record<AnalyticsRange, AnalyticsPeriodView>;
  rankMovers: AnalyticsRankMover[];
  trackedKeywordCount: number;
  sources: SourceStatus[];
  nextAction: NextAction;
  estimate: { organicTraffic: number; rankingKeywords: number; source: string } | null;
}) {
  const initialRange: AnalyticsRange = hasPeriodData(periods[90]) ? 90 : 30;
  const [range, setRange] = useState<AnalyticsRange>(initialRange);
  const [metricKey, setMetricKey] = useState<AnalyticsMetricKey>("impressions");
  const period = periods[range];
  const metric = period.metrics[metricKey];
  const allChartValues = [...metric.current, ...metric.previous].map((point) => point.value);
  const chartDomain = allChartValues.length ? {
    min: Math.min(...allChartValues),
    max: Math.max(...allChartValues),
  } : undefined;
  const currentPath = linePath(metric.current.map((point) => point.value), 760, 230, chartDomain);
  const previousPath = linePath(metric.previous.map((point) => point.value), 760, 230, chartDomain);
  const chartReady = allChartValues.length > 2 && Boolean(currentPath);
  const clickRate = period.metrics.impressions.total && period.metrics.clicks.total !== null
    ? `${((period.metrics.clicks.total / period.metrics.impressions.total) * 100).toFixed(1)}% click rate`
    : "Search visits";
  const engagedRate = period.metrics.clicks.total && period.metrics.engagedVisits.total !== null
    ? `${Math.min(100, (period.metrics.engagedVisits.total / period.metrics.clicks.total) * 100).toFixed(0)}% continued`
    : "On-site activity";
  const conversionsConnected = sources.some((source) => source.label === "Conversions" && source.connected);

  return <div className="analytics-redesign">
    <div className="analytics-range" aria-label="Analytics time range">
      {([30, 90] as const).map((days) => <button
        aria-pressed={range === days}
        disabled={!hasPeriodData(periods[days])}
        key={days}
        onClick={() => setRange(days)}
        type="button"
      >Last {days} days</button>)}
    </div>

    <div className="analytics-sources" aria-label="Analytics data sources">
      {sources.map((source) => <span className={`analytics-source ${source.connected ? "connected" : "offline"}`} key={source.label}>
        <i aria-hidden="true" />{source.label}<small>· {source.detail}</small>
      </span>)}
    </div>

    <section className="analytics-verdict" aria-labelledby="analytics-verdict-title">
      <span className="analytics-eyebrow" id="analytics-verdict-title">This period, in one sentence</span>
      <p>{period.verdictSegments.map((segment, index) => segment.highlight
        ? <strong className="analytics-verdict-highlight" key={`${segment.text}-${index}`}>{segment.text}</strong>
        : <span key={`${segment.text}-${index}`}>{segment.text}</span>)}</p>
      <small>{period.why}</small>
    </section>

    <section className="analytics-next-action" aria-label="Recommended next action">
      <div><span>Do this next</span><strong>{nextAction.title}</strong></div>
      <Link href={nextAction.href}>{nextAction.label}</Link>
    </section>

    <section aria-labelledby="search-journey-title">
      <h2 id="search-journey-title">The search journey</h2>
      <p className="analytics-section-copy">Follow how strangers become visitors—and where the next useful improvement is.</p>
      <div className="analytics-journey">
        {(["impressions", "clicks", "engagedVisits"] as const).map((key, index) => {
          const item = period.metrics[key];
          const miniPath = sparkPath(item);
          return <div className="analytics-journey-step-wrap" key={key}>
            {index > 0 && <div className="analytics-journey-arrow" aria-hidden="true"><span>→</span><small>{index === 1 ? clickRate : engagedRate}</small></div>}
            <button aria-pressed={metricKey === key} className="analytics-journey-step" onClick={() => setMetricKey(key)} type="button">
              <span>{item.name}</span>
              <strong>{formatValue(item.total)}</strong>
              <small className={item.changePercent !== null && item.changePercent < 0 ? "negative" : "positive"}>{changeLabel(item, range)}</small>
              {miniPath ? <svg aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 120 34"><path d={miniPath} /></svg> : <span className="analytics-spark-empty">Trend appears after the next data sync</span>}
              <em><i aria-hidden="true" />{item.source} · {item.detail}</em>
            </button>
          </div>;
        })}
      </div>
    </section>

    <section className="analytics-trend-panel" aria-labelledby="analytics-trend-title">
      <header>
        <div><h2 id="analytics-trend-title">{metric.name} — last {range} days</h2><p>One trend at a time, with the prior period as a quiet reference.</p></div>
        <div className="analytics-metric-tabs" aria-label="Search journey metric">
          {(["impressions", "clicks", "engagedVisits"] as const).map((key) => <button aria-pressed={metricKey === key} key={key} onClick={() => setMetricKey(key)} type="button">{period.metrics[key].name}</button>)}
        </div>
      </header>
      {chartReady ? <svg className="analytics-trend-chart" preserveAspectRatio="none" role="img" viewBox="0 0 760 230">
        <title>{`${metric.name} during the latest ${range} days compared with the prior period`}</title>
        <line x1="10" x2="750" y1="58" y2="58" /><line x1="10" x2="750" y1="115" y2="115" /><line x1="10" x2="750" y1="172" y2="172" />
        {previousPath && <path className="analytics-trend-previous" d={previousPath} />}
        <path className="analytics-trend-current" d={currentPath} />
        <text x="10" y="222">{range} days ago</text><text textAnchor="end" x="750" y="222">Latest complete day</text>
      </svg> : <div className="analytics-trend-empty"><strong>Your connected baseline is ready.</strong><span>A daily trend and prior-period comparison will appear after the next Google data sync.</span></div>}
      <footer><span><i className="current" />This period</span><span><i className="previous" />Prior period</span><span>Source: {metric.source}</span></footer>
    </section>

    <div className="analytics-breakdowns">
      <section className="analytics-breakdown" aria-labelledby="traffic-sources-title">
        <h2 id="traffic-sources-title">Where visitors come from</h2>
        <p>Share of measured sessions during this period.</p>
        {period.trafficSources.length ? <div className="analytics-traffic-list">{period.trafficSources.map((source) => <div className="analytics-traffic-row" key={source.label}>
          <span>{source.label}</span><div><i style={{ width: `${source.percent}%` }} /></div><strong>{source.percent}%</strong>
        </div>)}</div> : <div className="analytics-breakdown-empty"><strong>Traffic-source details are not available yet.</strong><span>Refresh Google Analytics to add this breakdown.</span></div>}
        <small className="analytics-panel-source"><i aria-hidden="true" />Google Analytics · connected data only</small>
      </section>

      <section className="analytics-breakdown" aria-labelledby="keyword-movers-title">
        <h2 id="keyword-movers-title">Keywords that moved</h2>
        <p>Only the latest movers—the full list stays in Rank tracker.</p>
        {rankMovers.length ? <div className="analytics-movers">{rankMovers.map((mover) => <div key={mover.keyword}>
          <span>{mover.keyword}</span><small>{rankPosition(mover.currentPosition)} <i>←</i> {rankPosition(mover.previousPosition)}</small><strong className={mover.tone}>{movementLabel(mover)}</strong>
        </div>)}</div> : <div className="analytics-breakdown-empty"><strong>No two-reading movement yet.</strong><span>Rebound SEO needs two rank checks before it can show a trustworthy change.</span></div>}
        <small className="analytics-panel-source"><i aria-hidden="true" />Rank tracker · {trackedKeywordCount.toLocaleString("en-US")} keyword{trackedKeywordCount === 1 ? "" : "s"} tracked · <Link href="/rank-tracker">See all keywords</Link></small>
      </section>
    </div>

    {!conversionsConnected && <section className="analytics-conversion-note"><span aria-hidden="true">◐</span><p><strong>No organic conversions are recorded yet.</strong> If conversion measurement is already configured, this note will clear after the first organic key event arrives. Otherwise, connect measurement to complete the journey.</p><Link href="/integrations">Review measurement</Link></section>}

    {estimate && <details className="analytics-estimate"><summary>Provider estimates—not website Analytics</summary><div><span><strong>{Math.round(estimate.organicTraffic).toLocaleString("en-US")}</strong> estimated monthly organic visits</span><span><strong>{Math.round(estimate.rankingKeywords).toLocaleString("en-US")}</strong> ranking keywords</span><small>{estimate.source}. These are modeled search estimates and remain separate from the connected metrics above.</small></div></details>}
  </div>;
}
