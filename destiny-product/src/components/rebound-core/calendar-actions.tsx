"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PanelResult } from "@/lib/rebound-core/contracts";
import { scheduleApprovedCalendarDraft, type ApprovedCalendarDraft } from "@/lib/rebound-core/calendar-scheduling";
import styles from "./core-pages.module.css";

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

export function CalendarActions({
  approvedDrafts,
  openDates,
  studioHref,
  timeZone,
  websiteId,
}: {
  approvedDrafts: PanelResult<ApprovedCalendarDraft[]>;
  openDates: string[];
  studioHref: string;
  timeZone: string;
  websiteId: string;
}) {
  const router = useRouter();
  const drafts = approvedDrafts.state === "ready" ? approvedDrafts.data ?? [] : [];
  const [draftId, setDraftId] = useState(drafts[0]?.id ?? "");
  const [localDate, setLocalDate] = useState(openDates[0] ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const selectedDraft = drafts.find((draft) => draft.id === draftId) ?? null;

  const schedule = async () => {
    if (!selectedDraft || !localDate || saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await scheduleApprovedCalendarDraft({ draft: selectedDraft, localDate, timeZone, websiteId });
      setNotice(`${selectedDraft.title} was added to ${dateLabel(localDate)} as planned.`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Rebound SEO could not schedule this approved draft.");
    } finally {
      setSaving(false);
    }
  };

  return <section className={styles.calendarActions} id="calendar-actions">
    <div><span>YOUR MOVE</span><h3>Schedule approved draft</h3><p>Choose an open day and an approved saved draft. Calendar stores its exact saved title and keyword with the date; it does not claim a permanent draft link.</p></div>
    {drafts.length && openDates.length ? <div className={styles.calendarActionForm}>
      <label>Approved draft<select aria-label="Approved draft" onChange={(event) => setDraftId(event.target.value)} value={draftId}>{drafts.map((draft) => <option key={draft.id} value={draft.id}>{draft.title} · {draft.keyword}</option>)}</select></label>
      <label>Open day<select aria-label="Open calendar day" onChange={(event) => setLocalDate(event.target.value)} value={localDate}>{openDates.map((date) => <option key={date} value={date}>{dateLabel(date)}</option>)}</select></label>
      <button className={styles.calendarActionPrimary} disabled={!selectedDraft || !localDate || saving} onClick={() => void schedule()} type="button">{saving ? "Scheduling…" : "Schedule approved draft"}</button>
    </div> : <div className={styles.calendarActionEmpty}><strong>{openDates.length ? "No approved draft is ready" : "No open day remains in this month"}</strong><p>{approvedDrafts.message ?? "Use Content Studio to review the next draft or publishing date."}</p></div>}
    <Link className={styles.calendarActionSecondary} href={studioHref}>Open Content Studio</Link>
    {notice ? <small className={styles.calendarActionNotice} role="status">{notice}</small> : null}
    {error ? <small className={styles.calendarActionError} role="alert">{error}</small> : null}
  </section>;
}
