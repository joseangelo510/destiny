"use client";

import { useEffect, useRef, useState } from "react";
import {
  SEARCH_INTENT_DEFINITIONS,
  calendarRowPresentation,
  type EditorialCalendarItem,
} from "../lib/content/editorial-calendar";

// Column definitions with plain-language explanations, surfaced through an
// accessible info popover on every header (click/tap and keyboard, not hover).
export const CALENDAR_COLUMNS = [
  { key: "schedule", label: "Schedule", info: "When this piece is planned to publish. A steady schedule helps you build momentum." },
  { key: "contentType", label: "Content type", info: "The format Destiny recommends, such as a service page, guide, FAQ, or comparison." },
  { key: "focusKeyword", label: "Focus keyword", info: "The main search phrase this content targets, so each page has a clear purpose." },
  { key: "monthlySearches", label: "Monthly searches", info: "An estimated number of U.S. searches for this keyword each month. Use it with intent and competition—not by itself." },
  { key: "title", label: "Title", info: "The recommended working headline, built around the keyword and your audience’s need." },
  { key: "searchIntent", label: "Search intent", info: "What the searcher is trying to do: learn, compare options, or take action. Matching intent helps content rank and convert." },
  { key: "status", label: "Status", info: "Where this idea is in your workflow: planned, draft ready, scheduled, or published." },
  { key: "action", label: "Action", info: "The next truthful step available for this content." },
] as const;

export type CalendarDraftState = { generationStatus: "starter" | "needs_generation" | "generated"; approved: boolean };

function InfoIcon() {
  // Original circled lowercase "i" — drawn for Destiny, no copied assets.
  return <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 16 16" width="16">
    <circle cx="8" cy="8" r="6.9" stroke="currentColor" strokeWidth="1.4" />
    <circle cx="8" cy="5.1" fill="currentColor" r="0.95" />
    <path d="M8 7.4v3.7" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
  </svg>;
}

export function EditorialCalendarTable({
  calendar,
  draftStates,
  onCreateContent,
  onReviewDraft,
  planMonths,
  questComplete,
  sourceLabel,
}: {
  calendar: EditorialCalendarItem[];
  draftStates: Record<string, CalendarDraftState | undefined>;
  onCreateContent: (item: EditorialCalendarItem) => void;
  onReviewDraft: (item: EditorialCalendarItem) => void;
  planMonths: number;
  questComplete: boolean;
  sourceLabel: string;
}) {
  const [openInfo, setOpenInfo] = useState<string | null>(null);
  const headRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!openInfo) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpenInfo(null); };
    const onPointerDown = (event: MouseEvent) => {
      if (headRef.current && event.target instanceof Node && !headRef.current.contains(event.target)) setOpenInfo(null);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [openInfo]);

  return <section className="workspace-card editorial-calendar-card">
    <div className="workspace-card-heading editorial-calendar-heading">
      <div><strong>Editorial calendar</strong><small>{sourceLabel}</small></div>
      <div className="editorial-calendar-meta"><span>{calendar.length} weeks · {planMonths} months</span></div>
    </div>
    <div className="content-table">
      <div className="content-row content-head" ref={headRef}>
        {CALENDAR_COLUMNS.map((column) => <span className={column.key === "monthlySearches" ? "numeric" : ""} key={column.key}>
          <span className="column-head-label">{column.label}</span>
          <span className="column-info">
            <button
              aria-controls={`column-info-${column.key}`}
              aria-expanded={openInfo === column.key}
              aria-label={`What does ${column.label} mean?`}
              className="column-info-button"
              onClick={() => setOpenInfo((current) => current === column.key ? null : column.key)}
              type="button"
            ><InfoIcon /></button>
            {openInfo === column.key && <span className="column-info-popover" id={`column-info-${column.key}`} role="note">{column.info}</span>}
          </span>
        </span>)}
      </div>
      {calendar.map((item, index) => {
        const intentDefinition = SEARCH_INTENT_DEFINITIONS[item.searchIntent];
        const draftState = draftStates[item.focusKeyword];
        const presentation = calendarRowPresentation({
          hasSavedDraft: Boolean(draftState && draftState.generationStatus !== "starter"),
          approvedForDelivery: Boolean(draftState?.approved && questComplete),
        });
        return (
          <div className="content-row" key={`${item.focusKeyword}-${index}`}>
            <span className="editorial-schedule" data-label="Schedule"><small>Month {item.month}</small><strong>Week {item.week}</strong></span>
            <span data-label="Content type"><strong>{item.contentType}</strong></span>
            <span data-label="Focus keyword"><strong>{item.focusKeyword}</strong></span>
            <span className="numeric" data-label="Monthly searches"><strong>{item.searchVolume.toLocaleString("en-US")}</strong><small>{item.priorityReason} · Difficulty {item.difficulty}</small></span>
            <span data-label="Title"><strong>{item.title}</strong></span>
            <span data-label="Search intent"><strong className={`intent-chip ${item.searchIntent}`}>{intentDefinition.label}</strong><small>{intentDefinition.summary}</small></span>
            <span data-label="Status"><span className={`status-chip ${presentation.status === "Planned" ? "amber" : ""}`}>{presentation.status}</span></span>
            <span data-label="Action">
              {presentation.action.kind === "view"
                ? <a className="calendar-action" href={presentation.action.url} rel="noreferrer" target="_blank">{presentation.action.label}</a>
                : <button className="calendar-action" onClick={() => presentation.action.kind === "create" ? onCreateContent(item) : onReviewDraft(item)} type="button">{presentation.action.label}</button>}
            </span>
          </div>
        );
      })}
    </div>
  </section>;
}
