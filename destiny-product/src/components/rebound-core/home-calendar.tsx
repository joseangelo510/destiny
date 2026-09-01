import Link from "next/link";
import type { CalendarSummary, PanelResult } from "@/lib/rebound-core/contracts";
import { MonthCalendar } from "./month-calendar";
import { EvidenceChip, Panel, PanelHeader } from "./primitives";
import styles from "./home-dashboard.module.css";

export function HomeCalendar({ result }: { result: PanelResult<CalendarSummary> }) {
  return <Panel className={styles.c12}><PanelHeader action="Open editorial calendar" href="/content#publishing-plan" subtitle="solid = your move · dashed = automatic · lime = verified" title="The month" />{result.state !== "ready" || !result.data ? <div className={styles.calendarEmpty}><p>{result.message}</p><Link href="/content#publishing-plan">Open the existing editorial calendar</Link></div> : <><MonthCalendar data={result.data} /><footer className={styles.panelRead}><span><b>Read:</b> only persisted publishing items appear here. Cadence, check-ins, and milestones are omitted until they have an authorized data source.</span><EvidenceChip evidence={result.evidence[0]} /></footer></>}</Panel>;
}
