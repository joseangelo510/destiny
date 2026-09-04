import Link from "next/link";
import type { CalendarSummary, PanelResult } from "@/lib/rebound-core/contracts";
import { MonthCalendar } from "./month-calendar";
import { EvidenceChip, Panel, PanelHeader } from "./primitives";
import styles from "./home-dashboard.module.css";

export function HomeCalendar({ result }: { result: PanelResult<CalendarSummary> }) {
  return <Panel className={styles.c12}><PanelHeader action="Open editorial calendar" href="/content#publishing-plan" subtitle="solid = your move · dashed = automatic · lime = verified" title="The month" />{result.state !== "ready" || !result.data ? <div className={styles.calendarEmpty}><p>{result.message}</p><Link href="/content#publishing-plan">Open the existing editorial calendar</Link></div> : <><MonthCalendar data={result.data} /><footer className={styles.panelRead}><span><b>Read:</b> saved publishing items use their real dates. Approved keyword topics stay clearly marked as unscheduled until a publishing date is chosen.</span><EvidenceChip evidence={result.evidence[0]} fallback={result.data.suggestions?.length ? "Approved keyword strategy" : "No schedule yet"} /></footer></>}</Panel>;
}
