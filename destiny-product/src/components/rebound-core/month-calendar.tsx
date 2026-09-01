import type { CalendarSummary } from "@/lib/rebound-core/contracts";
import { calendarMonthCells } from "@/lib/rebound-core/core-pages";
import styles from "./home-dashboard.module.css";

export function MonthCalendar({ data, emptyDayHref }: { data: CalendarSummary; emptyDayHref?: string }) {
  const cells = calendarMonthCells(data.events, data.anchorDate);
  return <>
    <div className={styles.calendarHead}><strong>{data.month}</strong><div><span><i className={styles.legendMove} />Your move</span><span><i className={styles.legendAutomatic} />Automatic</span><span><i className={styles.legendVerified} />Verified</span></div></div>
    <div className={styles.calendarGrid}><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div><div>Sun</div>{cells.map((cell) => <section className={cell.inMonth ? styles.calendarDay : `${styles.calendarDay} ${styles.outsideMonth}`} key={cell.key}><span>{cell.date.getUTCDate()}</span>{cell.events.slice(0, 2).map((event) => <p className={styles[`event_${event.tone}`]} key={event.id}>{event.title}</p>)}{cell.inMonth && !cell.events.length && emptyDayHref ? <a aria-label={`Add content on ${cell.key}`} className={styles.calendarAdd} href={emptyDayHref}>+ add content</a> : null}</section>)}</div>
    <div className={styles.calendarAgenda}>{cells.filter((cell) => cell.inMonth).flatMap((cell) => cell.events.length ? cell.events.map((event) => <div key={event.id}><time dateTime={event.date}>{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(event.date))}</time><strong>{event.title}</strong><span>{event.state.replaceAll("_", " ")}</span></div>) : emptyDayHref ? [<div key={cell.key}><time dateTime={cell.key}>{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(cell.date)}</time><strong>Open day</strong><a aria-label={`Add content on ${cell.key}`} className={styles.calendarAdd} href={emptyDayHref}>+ add content</a></div>] : [])}</div>
  </>;
}
