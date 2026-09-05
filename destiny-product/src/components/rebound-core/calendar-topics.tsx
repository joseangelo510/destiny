"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { CalendarSummary } from "@/lib/rebound-core/contracts";
import { calendarTopicId, startKeywordDraftHref } from "@/lib/content/plan-links";
import styles from "./home-dashboard.module.css";

export function CalendarTopics({ suggestions, websiteId, selectedKeyword }: { suggestions: NonNullable<CalendarSummary["suggestions"]>; websiteId?: string; selectedKeyword?: string }) {
  const selected = useRef<HTMLElement | null>(null);
  useEffect(() => { if (selectedKeyword && selected.current) { selected.current.focus({ preventScroll: true }); selected.current.scrollIntoView({ block: "center" }); } }, [selectedKeyword]);
  return <section className={styles.calendarSuggestions}><header><strong>Unscheduled topics</strong><span>Approved keyword topics · ready to write</span></header><div>{suggestions.map(suggestion => {
    const keyword = suggestion.title.toLowerCase();
    const highlighted = Boolean(selectedKeyword && calendarTopicId(selectedKeyword) === calendarTopicId(keyword));
    return <article id={calendarTopicId(keyword)} key={suggestion.id} ref={highlighted ? selected : undefined} tabIndex={highlighted ? -1 : undefined} data-highlighted={highlighted}>
      <span>In plan</span><strong>{suggestion.title}</strong><small>Approved topic · not scheduled</small>{websiteId ? <Link href={startKeywordDraftHref(keyword, websiteId)}>Start draft</Link> : null}
    </article>;
  })}</div></section>;
}
