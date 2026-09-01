import Link from "next/link";
import type { CompetitorSummary, PanelResult } from "@/lib/rebound-core/contracts";
import { Panel, PanelHeader } from "./primitives";
import styles from "./home-dashboard.module.css";

function host(value: string | null) {
  if (!value) return "URL not saved";
  try { return new URL(value).hostname.replace(/^www\./, ""); } catch { return value; }
}

export function HomeCompetitors({ result }: { result: PanelResult<CompetitorSummary> }) {
  return <Panel className={styles.c12}><PanelHeader action="Full analysis" href="/audits" subtitle="saved sites and evidence coverage" title="Competitors" />{result.state !== "ready" || !result.data ? <div className={styles.panelEmpty}><p>{result.message}</p><Link href="/audits">Open website audits</Link></div> : <div className={styles.competitorBody}><div><table><thead><tr><th>Site</th><th>Relationship</th><th>Current evidence</th></tr></thead><tbody><tr className={styles.youRow}><td><strong>{result.data.websiteLabel}</strong><small>Your selected website</small></td><td>Your site</td><td>Workspace connected</td></tr>{result.data.competitors.map((competitor) => <tr key={`${competitor.name}-${competitor.url}`}><td><strong>{competitor.name}</strong><small>{host(competitor.url)}</small></td><td>Saved competitor</td><td>Analysis appears when a current audit provides it</td></tr>)}</tbody></table></div><aside><h3>What Rebound SEO can say today</h3><p>{result.data.competitors.length} competitor{result.data.competitors.length === 1 ? " is" : "s are"} saved for this website.</p><p>Visibility, publishing pace, and weekly actions stay blank until a current provider receipt supports them.</p><Link href="/audits">Review current audit evidence</Link></aside></div>}</Panel>;
}
