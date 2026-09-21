"use client";

import { useState } from "react";
import type { CalendarSummary, PanelResult } from "@/lib/rebound-core/contracts";
import type { ApprovedCalendarDraft } from "@/lib/rebound-core/calendar-scheduling";
import { openCalendarDates } from "@/lib/rebound-core/core-pages";
import { CalendarActions } from "./calendar-actions";
import { MonthCalendar } from "./month-calendar";
import { Panel, PanelHeader } from "./primitives";

export function CalendarPlanner({ calendar, approvedDrafts, studioHref, timeZone, websiteId, selectedKeyword }: {
  calendar: CalendarSummary;
  approvedDrafts: PanelResult<ApprovedCalendarDraft[]>;
  studioHref: string;
  timeZone: string;
  websiteId: string;
  selectedKeyword?: string;
}) {
  const openDates = openCalendarDates(calendar);
  const [selectedDate, setSelectedDate] = useState(openDates[0] ?? "");
  // A refreshed schedule can occupy the chosen day; require a new choice then.
  const localDate = openDates.includes(selectedDate) ? selectedDate : "";
  const selectDay = (date: string) => {
    if (openDates.includes(date)) setSelectedDate(date);
  };
  return <>
    <Panel><PanelHeader action="Open publishing plan" href={studioHref} subtitle="your planned work, one week at a time" title="The month" /><MonthCalendar data={calendar} emptyDayHref="#calendar-actions" openDates={openDates} onSelectDay={selectDay} websiteId={websiteId} selectedKeyword={selectedKeyword} /></Panel>
    <CalendarActions approvedDrafts={approvedDrafts} localDate={localDate} onDateChange={selectDay} openDates={openDates} studioHref={studioHref} timeZone={timeZone} websiteId={websiteId} />
  </>;
}
