import type { CalendarEvent, CalendarSummary } from "@/lib/rebound-core/contracts";
import styles from "./home-dashboard.module.css";

function dateKey(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function monthCells(events: CalendarEvent[]) {
  const firstEvent = events.map((event) => new Date(event.date)).find((date) => !Number.isNaN(date.getTime())) ?? new Date();
  const year = firstEvent.getUTCFullYear();
  const month = firstEvent.getUTCMonth();
  const first = new Date(Date.UTC(year, month, 1));
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  const start = new Date(first);
  start.setUTCDate(first.getUTCDate() - mondayOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);
    return { date, key, inMonth: date.getUTCMonth() === month, events: events.filter((event) => dateKey(event.date) === key) };
  });
}

export function MonthCalendar({ data }: { data: CalendarSummary }) {
  const cells = monthCells(data.events);
  return <>
    <div className={styles.calendarHead}><strong>{data.month}</strong><div><span><i className={styles.legendMove} />Your move</span><span><i className={styles.legendAutomatic} />Automatic</span><span><i className={styles.legendVerified} />Verified</span></div></div>
    <div className={styles.calendarGrid}><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div><div>Sun</div>{cells.map((cell) => <section className={cell.inMonth ? styles.calendarDay : `${styles.calendarDay} ${styles.outsideMonth}`} key={cell.key}><span>{cell.date.getUTCDate()}</span>{cell.events.slice(0, 2).map((event) => <p className={styles[`event_${event.tone}`]} key={event.id}>{event.title}</p>)}</section>)}</div>
    <div className={styles.calendarAgenda}>{data.events.map((event) => <div key={event.id}><time dateTime={event.date}>{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(event.date))}</time><strong>{event.title}</strong><span>{event.state.replaceAll("_", " ")}</span></div>)}</div>
  </>;
}
