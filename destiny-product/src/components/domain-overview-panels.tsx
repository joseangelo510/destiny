"use client";

import { useState } from "react";
import { DOMAIN_MARKETS, type DomainOverview } from "../../supabase/functions/seo-research/domain-overview";
import { DomainDataTable } from "./domain-overview-table";
import styles from "./domain-overview.module.css";

export const formatMetric = (value: number | null, money = false) => value === null ? "Unavailable" : new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1, ...(money ? { style: "currency", currency: "USD" } : {}) }).format(value);
const countryNames: Record<number,string> = { 2356: "India", 2076: "Brazil", 2392: "Japan", 2484: "Mexico", 2528: "Netherlands", 2380: "Italy", 2752: "Sweden", 2756: "Switzerland", 2702: "Singapore", 2710: "South Africa", 2554: "New Zealand", 2410: "South Korea", 2372: "Ireland", 2608: "Philippines", 2360: "Indonesia", 2784: "United Arab Emirates", 2792: "Türkiye", 2616: "Poland", 2620: "Portugal", 2056: "Belgium", 2040: "Austria", 2208: "Denmark", 2578: "Norway", 2246: "Finland", 2158: "Taiwan", 2344: "Hong Kong", 2458: "Malaysia", ...Object.fromEntries(Object.values(DOMAIN_MARKETS).map(market => [market.code,market.label])) };
const country = (code: number | null) => code === null ? "Unknown location" : countryNames[code] || `Location ${code}`;
const emptyMessage = (report: DomainOverview, key: string) => report.sections[key]?.state === "unavailable" ? "This source is temporarily unavailable. Try another lookup later." : "No records were returned for this domain and market.";

export function DomainSummary({ report }: { report: DomainOverview }) {
  const s = report.summary;
  const items = [
    ["Domain rank",s.rank,"DataForSEO backlink rank · 0–100"], ["Organic traffic",s.organicTraffic,"Estimated monthly search visits"], ["Paid traffic",s.paidTraffic,"Estimated monthly paid visits"], ["Referring domains",s.referringDomains,"Worldwide · live linking domains"],
    ["Traffic value",s.trafficValue,"Estimated organic replacement cost"], ["Organic keywords",s.organicKeywords,"Selected market · provider total"], ["Paid keywords",s.paidKeywords,"Selected market · provider total"], ["Backlinks",s.backlinks,"Worldwide · live links"],
  ] as const;
  return <div className={styles.summaryGrid}>
    <section className={styles.card}><span className={styles.tag}>AI SEARCH</span><div className={styles.aiNumber}><span>Mentions</span><strong>{formatMetric(report.ai.mentions)}</strong></div><p className={styles.small}>Observed in the provider’s AI answer index.</p>{report.ai.platforms.length ? report.ai.platforms.map(item => <div className={styles.platform} key={item.platform}><span>{item.platform}</span><b>{formatMetric(item.mentions)}</b></div>) : <p className={styles.small}>{emptyMessage(report,"ai")}</p>}</section>
    <section className={styles.card}><span className={styles.tag}>SEO</span><div className={styles.metrics}>{items.map(([label,value,help]) => <div key={label} title={help}><span>{label}</span><strong className={value === null ? styles.unavailable : undefined}>{formatMetric(value,label === "Traffic value")}</strong><small>{help}</small></div>)}</div></section>
  </div>;
}

export function CountryTable({ report, full = false }: { report: DomainOverview; full?: boolean }) {
  const list = report.countries.map(item => ({ country: country(item.code), language: item.language.toUpperCase(), traffic: item.organicTraffic, keywords: item.organicKeywords, paidTraffic: item.paidTraffic }));
  return <section className={styles.card}><h3>Distribution by country</h3><p className={styles.small}>Country and language databases. Keyword counts can overlap.</p>{full ? <DomainDataTable title="Country comparison" rows={list} columns={[{key:"country",label:"Country"},{key:"language",label:"Language"},{key:"traffic",label:"Organic traffic"},{key:"keywords",label:"Keywords"},{key:"paidTraffic",label:"Paid traffic"}]} empty={emptyMessage(report,"overview")} /> : <><div className={styles.tableScroll}><table><thead><tr><th>Country</th><th>Traffic</th><th>Keywords</th></tr></thead><tbody>{list.slice(0,7).map((item,index) => <tr key={`${item.country}-${item.language}-${index}`}><td>{item.country}<small className={styles.language}>{item.language}</small></td><td>{formatMetric(item.traffic)}</td><td>{formatMetric(item.keywords)}</td></tr>)}</tbody></table></div>{!list.length && <p>{emptyMessage(report,"overview")}</p>}<h3 className={styles.subheading}>Google ranking distribution</h3><div className={styles.positions}>{report.positions.map(item => <div key={item.label}><span>{item.label}</span><meter min={0} max={Math.max(...report.positions.map(point => point.value ?? 0),1)} value={item.value ?? 0} aria-label={`${item.label}: ${formatMetric(item.value)}`} /><b>{formatMetric(item.value)}</b></div>)}</div></>}</section>;
}

export function HistoryPanel({ report, growth }: { report: DomainOverview; growth: boolean }) {
  const [period,setPeriod] = useState(6), [metric,setMetric] = useState<"organicTraffic" | "paidTraffic" | "organicKeywords" | "paidKeywords">("organicTraffic");
  const points = period ? report.history.slice(-period) : report.history;
  const maximum = Math.max(...points.map(point => point[metric] ?? 0),1);
  const first = points[0]?.[metric], last = points.at(-1)?.[metric];
  const change = typeof first === "number" && first > 0 && typeof last === "number" ? ((last-first)/first*100).toFixed(1) : null;
  const labels = { organicTraffic: "Organic traffic", paidTraffic: "Paid traffic", organicKeywords: "Organic keywords", paidKeywords: "Paid keywords" };
  return <section className={styles.card}><div className={styles.sectionHead}><h3>{growth ? "Growth report" : "Traffic & keyword trends"}</h3><div className={styles.periods} role="group" aria-label="History range">{[[1,"1M"],[6,"6M"],[12,"1Y"],[24,"2Y"],[0,"All"]].map(([value,label]) => <button key={value} aria-pressed={period === value} onClick={() => setPeriod(Number(value))}>{label}</button>)}</div></div>
    <label className={styles.metricSelect}>Show<select value={metric} onChange={event => setMetric(event.target.value as typeof metric)}>{Object.entries(labels).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    <div className={styles.trendValue}><strong>{formatMetric(last ?? null)}</strong><span>{change !== null ? `${Number(change) >= 0 ? "+" : ""}${change}% across displayed months` : "Monthly provider estimates"}</span></div>
    {points.length ? <><div className={styles.chart} role="img" aria-label={`${labels[metric]} trend for ${report.target}. Exact monthly values in the table below.`}><svg viewBox="0 0 700 210" preserveAspectRatio="none" aria-hidden="true"><line x1="15" x2="685" y1="190" y2="190" stroke="currentColor" opacity=".2" />{points.map((point,index) => { const value = point[metric], next = points[index+1]?.[metric]; const x = 20+index*(660/Math.max(points.length-1,1)), y = 185-((value ?? 0)/maximum)*165; return value === null ? null : <g key={point.date}>{typeof next === "number" && <line x1={x} y1={y} x2={20+(index+1)*(660/Math.max(points.length-1,1))} y2={185-(next/maximum)*165} stroke="currentColor" strokeWidth="3" />}<circle cx={x} cy={y} r="4" fill="currentColor" /></g>; })}</svg></div><div className={styles.chartLabels}><span>{points[0].date.slice(0,7)}</span><span>{points.at(-1)?.date.slice(0,7)}</span></div><details className={styles.monthly}><summary>View monthly values</summary><DomainDataTable title="Monthly values" rows={points.map(point => ({month:point.date.slice(0,7),value:point[metric]}))} columns={[{key:"month",label:"Month"},{key:"value",label:labels[metric]}]} empty="No monthly values." /></details></> : <p className={styles.noHistory}>{emptyMessage(report,"history")}</p>}
    {growth && <div className={styles.movements}>{Object.entries(report.movement).map(([key,value]) => <div key={key}><span>{key}</span><strong>{formatMetric(value)}</strong></div>)}</div>}
  </section>;
}

export function ResearchTables({ report }: { report: DomainOverview }) {
  const keywordColumns = [{key:"keyword",label:"Keyword"},{key:"intent",label:"Intent"},{key:"position",label:"Position"},{key:"volume",label:"Volume"},{key:"difficulty",label:"Difficulty"},{key:"cpc",label:"CPC (USD)"},{key:"traffic",label:"Traffic"},{key:"url",label:"Ranking page",link:true}];
  return <div className={styles.researchGrid}>
    <section className={`${styles.card} ${styles.wide}`}><h3>Organic research</h3><DomainDataTable title="Organic keywords" rows={report.keywords} columns={keywordColumns} empty={emptyMessage(report,"keywords")} /></section>
    <section className={styles.card}><h3>Top pages</h3><DomainDataTable title="Top pages" rows={report.pages} columns={[{key:"url",label:"Page",link:true},{key:"organicTraffic",label:"Traffic"},{key:"organicKeywords",label:"Keywords"}]} empty={emptyMessage(report,"pages")} /></section>
    <section className={styles.card}><h3>Organic competitors</h3><DomainDataTable title="Organic competitors" rows={report.competitors} columns={[{key:"domain",label:"Domain"},{key:"commonKeywords",label:"Shared keywords"},{key:"organicTraffic",label:"Traffic"}]} empty={emptyMessage(report,"competitors")} /></section>
    <section className={`${styles.card} ${styles.wide}`}><h3>Advertising research</h3><p className={styles.small}>Estimated paid traffic cost: {formatMetric(report.summary.paidCost,true)} / month. Ad text is included where the provider returns it.</p><DomainDataTable title="Paid keywords" rows={report.paidKeywords} columns={[...keywordColumns,{key:"title",label:"Ad headline"},{key:"description",label:"Ad description"}]} empty={emptyMessage(report,"paidKeywords")} /></section>
    <section className={`${styles.card} ${styles.wide}`}><h3>Backlinks</h3><p className={styles.small}>Live links worldwide · Spam score: {formatMetric(report.summary.spamScore)} / 100</p><DomainDataTable title="Backlinks" rows={report.links} columns={[{key:"from",label:"Source page",link:true},{key:"to",label:"Target page",link:true},{key:"anchor",label:"Anchor"},{key:"rank",label:"Rank / 100"},{key:"dofollow",label:"Dofollow"},{key:"firstSeen",label:"First seen"}]} empty={emptyMessage(report,"links")} /></section>
    <section className={styles.card}><h3>Referring domains</h3><DomainDataTable title="Referring domains" rows={report.referring} columns={[{key:"domain",label:"Domain"},{key:"rank",label:"Rank / 100"},{key:"backlinks",label:"Backlinks"}]} empty={emptyMessage(report,"referring")} /></section>
    <section className={styles.card}><h3>Top anchors</h3><DomainDataTable title="Top anchors" rows={report.anchors} columns={[{key:"anchor",label:"Anchor"},{key:"backlinks",label:"Backlinks"},{key:"referringDomains",label:"Domains"}]} empty={emptyMessage(report,"anchors")} /></section>
    <section className={styles.card}><h3>Top cited sources</h3><p className={styles.small}>Domains appearing as sources alongside the target in matched AI answers.</p><DomainDataTable title="AI cited sources" rows={report.ai.sources} columns={[{key:"domain",label:"Source"},{key:"mentions",label:"Mentions"}]} empty={emptyMessage(report,"ai")} /></section>
  </div>;
}
