import Link from "next/link";
import type { CompetitorSummary, PanelResult } from "@/lib/rebound-core/contracts";
import { Panel, PanelHeader } from "./primitives";
import { CompetitorAuditRefresh } from "./competitor-audit-refresh";
import styles from "./home-dashboard.module.css";

function host(value: string | null) {
  if (!value) return "URL not saved";
  try { return new URL(value).hostname.replace(/^www\./, ""); } catch { return value; }
}

export function HomeCompetitors({ result, websiteId }: { result: PanelResult<CompetitorSummary>; websiteId: string }) {
  return <Panel className={styles.c12}><PanelHeader action="Full analysis" href="/audits" subtitle="latest saved audit and DataForSEO overlap" title="Competitors" />{result.state !== "ready" || !result.data ? <div className={styles.panelEmpty}><p>{result.message}</p><Link href="/audits">Open website audits</Link></div> : <div className={styles.competitorBody}><div><table><thead><tr><th>Site</th><th>Relationship</th><th>Current evidence</th></tr></thead><tbody><tr className={styles.youRow}><td><strong>{result.data.websiteLabel}</strong><small>Your selected website</small></td><td>Your site</td><td>Workspace connected</td></tr>{result.data.competitors.map((competitor) => <tr key={`${competitor.relationship}-${competitor.domain}`}><td><strong>{competitor.name}</strong><small>{competitor.domain || host(competitor.url)}</small></td><td>{competitor.relationship}</td><td>{competitor.sharedKeywords === null ? "Awaiting a provider match" : competitor.sharedKeywords === 0 ? "No overlap measured in this audit" : `${competitor.sharedKeywords.toLocaleString("en-US")} shared keyword${competitor.sharedKeywords === 1 ? "" : "s"}`}</td></tr>)}</tbody></table></div><aside><h3>Latest competitor evidence</h3><p>{result.data.sourceLabel ? `${result.data.sourceLabel}${result.data.fetchedAt ? ` · ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(result.data.fetchedAt))}` : ""}` : "Saved competitors are ready for a fresh provider audit."}</p><p>{result.data.competitors.filter((item) => item.sharedKeywords !== null && item.sharedKeywords > 0).length} competitor{result.data.competitors.filter((item) => item.sharedKeywords !== null && item.sharedKeywords > 0).length === 1 ? " has" : "s have"} measured search overlap. Rebound SEO leaves unmatched rows blank instead of estimating them.</p><Link href="/audits">Review current audit evidence</Link><CompetitorAuditRefresh websiteId={websiteId} /></aside></div>}</Panel>;
}
