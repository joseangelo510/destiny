import type { CalendarEvent, CalendarSummary } from "./contracts";
import { calendarLocalDateKey } from "./core-pages";

function monthLabel(dateKey: string) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${dateKey}T12:00:00Z`));
}

export function buildHomeCalendarSummary({ events, now = new Date(), suggestions = [], timeZone }: { events: CalendarEvent[]; now?: Date; suggestions?: CalendarSummary["suggestions"]; timeZone: string }): CalendarSummary {
  const anchorDate = calendarLocalDateKey(now, timeZone);
  return { month: monthLabel(anchorDate), anchorDate, events, suggestions };
}
