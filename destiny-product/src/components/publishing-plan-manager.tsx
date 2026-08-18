"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { buildWeeklySchedule, publishingCalendarState, reconcilePublishingItems, type PublishingCalendarState, type PublishingMode, type PublishingPlanRecord, type PublishingScheduleItemRecord } from "@/lib/content/publishing-plan";

type CalendarItem = { focusKeyword: string; title: string; contentType: string };

const MODES: Array<{ id: PublishingMode; title: string; description: string; note: string }> = [
  { id: "review_each", title: "Review each article", description: "Destiny creates WordPress drafts. You approve each article before choosing its date.", note: "Most control" },
  { id: "batch_schedule", title: "Approve and schedule in a batch", description: "Review several finished articles, approve them together, and schedule the selected posts.", note: "Balanced" },
  { id: "automatic", title: "Publish automatically", description: "Destiny schedules articles that pass every quality check. Anything uncertain stops for review.", note: "Most hands-off" },
];

const STATE_META: Record<PublishingCalendarState, { label: string; short: string; icon: string; description: string }> = {
  planned: { label: "Planned", short: "Plan", icon: "", description: "This topic has a place in the plan, but it is not scheduled in a CMS yet." },
  needs_review: { label: "Needs review", short: "Review", icon: "!", description: "Your review is required before this article can move forward." },
  scheduled: { label: "CMS-confirmed scheduled", short: "Sched", icon: "◷", description: "The CMS confirmed this post and its future publication time." },
  published: { label: "Live and verified", short: "Live", icon: "✓", description: "Destiny verified that this post is live." },
  failed: { label: "Failed", short: "Failed", icon: "×", description: "The CMS did not complete this publishing attempt." },
  missed: { label: "Missed", short: "Missed", icon: "◷", description: "The planned time passed without a verified publication." },
  manual: { label: "Manual", short: "Manual", icon: "↗", description: "This post must be scheduled directly in Wix for now." },
};

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

function dateKeyInTimezone(value: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const record = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${record.year}-${record.month}-${record.day}`;
}

function shiftMonth(month: string, amount: number) {
  const date = new Date(`${month.slice(0, 7)}-01T12:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + amount);
  return date.toISOString().slice(0, 7) + "-01";
}

function monthTitle(month: string) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}T12:00:00.000Z`));
}

function formattedPublishTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

function futureStartDate() {
  const date = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

export function PublishingPlanManager({ websiteId, auditId, calendar, wordpressConnected, approvedKeywordCount, websitePlatform, initialPlan, initialItems }: {
  websiteId: string;
  auditId: string;
  calendar: CalendarItem[];
  wordpressConnected: boolean;
  approvedKeywordCount: number;
  websitePlatform: string | null;
  initialPlan: PublishingPlanRecord | null;
  initialItems: PublishingScheduleItemRecord[];
}) {
  const router = useRouter();
  const [plan, setPlan] = useState(initialPlan);
  const [items, setItems] = useState(initialItems);
  const [mode, setMode] = useState<PublishingMode | "">(initialPlan?.mode ?? "");
  const [startDate, setStartDate] = useState(initialPlan?.start_date ?? futureStartDate());
  const [automaticConfirmed, setAutomaticConfirmed] = useState(false);
  const [editing, setEditing] = useState(!initialPlan);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [currentMonth, setCurrentMonth] = useState(`${(initialPlan?.start_date ?? startDate).slice(0, 7)}-01`);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles";
  const dates = useMemo(() => buildWeeklySchedule(startDate, calendar.length, timezone), [startDate, calendar.length, timezone]);
  const planTimezone = plan?.timezone || timezone;
  const displayState = (item: PublishingScheduleItemRecord) => publishingCalendarState(item, websitePlatform);
  const counts = useMemo(() => items.reduce<Record<string, number>>((result, item) => {
    const state = publishingCalendarState(item, websitePlatform);
    return { ...result, [state]: (result[state] ?? 0) + 1 };
  }, {}), [items, websitePlatform]);
  const selectedItem = items.find((item) => item.id === selectedItemId) ?? null;
  const calendarDays = useMemo(() => {
    const first = new Date(`${currentMonth}T12:00:00.000Z`);
    const mondayOffset = (first.getUTCDay() + 6) % 7;
    const start = new Date(first.getTime() - mondayOffset * 24 * 60 * 60 * 1000);
    const itemsByDate = items.reduce<Record<string, PublishingScheduleItemRecord[]>>((result, item) => {
      const key = dateKeyInTimezone(item.scheduled_for, planTimezone);
      result[key] = [...(result[key] ?? []), item];
      return result;
    }, {});
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start.getTime() + index * 24 * 60 * 60 * 1000);
      const key = date.toISOString().slice(0, 10);
      return { key, day: date.getUTCDate(), current: key.slice(0, 7) === currentMonth.slice(0, 7), items: itemsByDate[key] ?? [] };
    });
  }, [currentMonth, items, planTimezone]);
  const missingApprovals = approvedKeywordCount < 1;
  const wixUnsupported = websitePlatform === "wix" && !wordpressConnected;
  const cmsUnavailable = !wordpressConnected;

  useEffect(() => {
    const key = `destiny-publishing-view:${websiteId}`;
    const saved = window.localStorage.getItem(key);
    const nextView = saved === "calendar" || saved === "list" ? saved : window.matchMedia("(max-width: 720px)").matches ? "list" : "calendar";
    const timer = window.setTimeout(() => setViewMode(nextView), 0);
    return () => window.clearTimeout(timer);
  }, [websiteId]);

  const chooseView = (value: "calendar" | "list") => {
    setViewMode(value);
    window.localStorage.setItem(`destiny-publishing-view:${websiteId}`, value);
  };

  const save = async () => {
    if (!mode || saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/content/publishing-plan", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteId,
          auditId,
          mode,
          startDate,
          timezone,
          automaticConfirmed,
          calendar: calendar.map((item) => ({ keyword: item.focusKeyword, title: item.title, contentType: item.contentType })),
        }),
      });
      const payload = await response.json() as { error?: string; plan?: PublishingPlanRecord; items?: PublishingScheduleItemRecord[] };
      if (!response.ok || !payload.plan) throw new Error(payload.error || "Destiny could not save the publishing plan.");
      setPlan(payload.plan);
      setItems(payload.items ?? []);
      setEditing(false);
      setAutomaticConfirmed(false);
      if (mode === "automatic") await runChecks();
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Destiny could not save the publishing plan.");
    } finally {
      setSaving(false);
    }
  };

  const runChecks = async () => {
    setError("");
    setNotice("");
    const response = await fetch("/api/content/publishing-plan/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ websiteId }) });
    const payload = await response.json() as { error?: string; checked?: number; scheduled?: number; items?: PublishingScheduleItemRecord[] };
    if (!response.ok) throw new Error(payload.error || "Destiny could not run the scheduling checks.");
    setItems((current) => reconcilePublishingItems(current, payload.items));
    setNotice(payload.scheduled
      ? `${payload.scheduled} article${payload.scheduled === 1 ? "" : "s"} scheduled in WordPress. Other slots remain safely queued.`
      : `Destiny checked ${payload.checked ?? 0} ready slot${payload.checked === 1 ? "" : "s"}. Nothing was scheduled because the remaining articles still need generation or review.`);
  };

  const checkNow = async () => {
    if (saving) return;
    setSaving(true);
    try { await runChecks(); router.refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Destiny could not run the scheduling checks."); }
    finally { setSaving(false); }
  };

  const setStatus = async (status: "active" | "paused") => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/content/publishing-plan", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ websiteId, status }) });
      const payload = await response.json() as { error?: string; plan?: PublishingPlanRecord };
      if (!response.ok || !payload.plan) throw new Error(payload.error || "Destiny could not update the plan.");
      setPlan(payload.plan);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Destiny could not update the plan.");
    } finally { setSaving(false); }
  };

  return <section className="workspace-card publishing-plan" id="publishing-plan">
    <div className="publishing-plan-heading">
      <div><span className="eyebrow">Publishing plan</span><h2>{plan && !editing ? "Your three-month publishing rhythm" : "How involved do you want to be?"}</h2><p>{plan && !editing ? "WordPress owns every future date. Destiny tracks readiness and stops anything that needs attention." : "Choose once for this plan. You can change it later without losing the calendar."}</p></div>
      {plan && !editing && <span className={`status-chip ${plan.status === "active" ? "" : "amber"}`}>{plan.status === "active" ? "Active" : plan.status === "paused" ? "Paused" : "Needs attention"}</span>}
    </div>
    {missingApprovals ? <div className="configuration-note"><strong>Approve topics before scheduling</strong><p>Only explicitly approved keyword topics can enter a publishing plan. Review the Keyword strategy first.</p></div>
      : wixUnsupported ? <div className="configuration-note"><strong>Wix scheduling is not connected yet</strong><p>Destiny cannot honestly confirm a Wix-native scheduled post yet. Generate and review content here, then schedule it in Wix until the direct connection ships.</p></div>
      : cmsUnavailable ? <div className="configuration-note"><strong>Connect WordPress before scheduling</strong><p>Destiny can save reviewed content, but it will not create a CMS schedule until the WordPress connection is healthy.</p></div> : null}
    {editing ? <>
      <div className="publishing-mode-grid" role="radiogroup" aria-label="Publishing mode">
        {MODES.map((option) => <button aria-checked={mode === option.id} className={mode === option.id ? "active" : ""} key={option.id} onClick={() => { setMode(option.id); setAutomaticConfirmed(false); }} role="radio" type="button"><small>{option.note}</small><strong>{option.title}</strong><span>{option.description}</span></button>)}
      </div>
      <div className="publishing-date-row"><label>First publication date<input min={futureStartDate()} type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><div><small>Three-month range</small><strong>{dates.length ? `${new Date(dates[0]).toLocaleDateString()} – ${new Date(dates.at(-1)!).toLocaleDateString()}` : "Choose a start date"}</strong><span>{calendar.length} weekly posts · at least 72 hours before each date</span></div></div>
      {mode === "automatic" && <label className="automatic-confirmation"><input checked={automaticConfirmed} onChange={(event) => setAutomaticConfirmed(event.target.checked)} type="checkbox" /><span><strong>Confirm automatic scheduling for {calendar.length} posts</strong><small>Destiny may schedule these dates only after every article passes its quality checks. The first two posts will be marked “review recommended.” Failures stop instead of publishing.</small></span></label>}
      {error && <div className="error-banner" role="alert">{error}</div>}
      <div className="publishing-plan-actions"><button className="primary-button" disabled={!mode || saving || missingApprovals || cmsUnavailable || (mode === "automatic" && !automaticConfirmed)} onClick={() => void save()} type="button">{saving ? "Saving plan…" : plan ? "Save changes" : "Start this publishing plan"}</button>{plan && <button className="secondary-button" disabled={saving} onClick={() => { setEditing(false); setMode(plan.mode); }} type="button">Cancel</button>}</div>
    </> : plan ? <>
      <div className="publishing-plan-summary"><div><small>Mode</small><strong>{MODES.find((item) => item.id === plan.mode)?.title}</strong></div><div><small>Calendar</small><strong>{new Date(`${plan.start_date}T12:00:00Z`).toLocaleDateString()} – {new Date(`${plan.end_date}T12:00:00Z`).toLocaleDateString()}</strong></div><div><small>Progress</small><strong>{counts.published ?? 0} published · {counts.scheduled ?? 0} scheduled</strong></div></div>
      <div className="publishing-calendar-toolbar">
        <div aria-label="Publishing plan view" className="publishing-view-toggle" role="group">
          <button aria-pressed={viewMode === "list"} onClick={() => chooseView("list")} type="button">List</button>
          <button aria-pressed={viewMode === "calendar"} onClick={() => chooseView("calendar")} type="button">Calendar</button>
        </div>
        {viewMode === "calendar" && <div className="publishing-month-controls">
          <button aria-label="Previous month" onClick={() => setCurrentMonth((value) => shiftMonth(value, -1))} type="button">←</button>
          <strong>{monthTitle(currentMonth)}</strong>
          <button onClick={() => setCurrentMonth(`${dateKeyInTimezone(new Date().toISOString(), planTimezone).slice(0, 7)}-01`)} type="button">Today</button>
          <button aria-label="Next month" onClick={() => setCurrentMonth((value) => shiftMonth(value, 1))} type="button">→</button>
        </div>}
        <small className="publishing-timezone">Times shown in {planTimezone}</small>
      </div>

      {viewMode === "calendar" ? <div aria-label="Publishing calendar view" className="publishing-calendar-view">
        <div className="publishing-calendar-weekdays">{WEEKDAYS.map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
        <div className="publishing-calendar-grid">
          {calendarDays.map((day) => <div className={`publishing-calendar-day${day.current ? "" : " muted"}`} key={day.key}>
            <time dateTime={day.key}>{day.day}</time>
            <div className="publishing-calendar-day-items">{day.items.map((item) => {
              const state = displayState(item);
              const meta = STATE_META[state];
              return <button aria-label={`${item.title}: ${meta.label}`} className={`publishing-calendar-chip ${state}`} key={item.id} onClick={() => setSelectedItemId(item.id)} title={`${item.title} · ${meta.label}`} type="button">{meta.icon && <span aria-hidden="true">{meta.icon}</span>}{meta.short}</button>;
            })}</div>
          </div>)}
        </div>
        {!calendarDays.some((day) => day.current && day.items.length) && <div className="publishing-calendar-empty"><strong>No posts planned for {monthTitle(currentMonth)}</strong><button onClick={() => setEditing(true)} type="button">Change mode or dates</button></div>}
      </div> : <ol aria-label="Publishing agenda view" className="publishing-queue-preview publishing-agenda-view">{items.map((item) => {
        const state = displayState(item);
        const meta = STATE_META[state];
        return <li key={item.id}><span>{item.position}</span><div><strong>{item.title}</strong><small>{formattedPublishTime(item.scheduled_for, planTimezone)} · {meta.label}{item.review_recommended ? " · review recommended" : ""}</small>{item.last_error && <em>{item.last_error}</em>}</div><button aria-label={`Open ${item.title}`} className={`publishing-agenda-state ${state}`} onClick={() => setSelectedItemId(item.id)} type="button">{meta.icon} {meta.short}</button></li>;
      })}</ol>}

      <div aria-label="Publishing state legend" className="publishing-calendar-legend">{(["planned", "needs_review", "scheduled", "published", "failed", ...(websitePlatform === "wix" ? ["manual"] : [])] as PublishingCalendarState[]).map((state) => <span className={state} key={state}><i aria-hidden="true" />{state === "failed" ? "Failed / missed" : STATE_META[state].label}</span>)}</div>

      {selectedItem && (() => {
        const state = displayState(selectedItem);
        const meta = STATE_META[state];
        return <aside aria-label="Scheduled post details" aria-modal="false" className="publishing-post-detail" role="dialog">
          <div className="publishing-post-detail-heading"><div><span className="eyebrow">Post details</span><h3>{selectedItem.title}</h3></div><button aria-label="Close post details" onClick={() => setSelectedItemId(null)} type="button">×</button></div>
          <span className={`publishing-detail-status ${state}`}>{meta.icon} {meta.label}</span>
          <p>{meta.description}</p>
          <dl><div><dt>Publish time</dt><dd>{formattedPublishTime(selectedItem.scheduled_for, planTimezone)}</dd></div><div><dt>Focus keyword</dt><dd>{selectedItem.keyword}</dd></div>{selectedItem.remote_id && <div><dt>CMS post ID</dt><dd>{selectedItem.remote_id}</dd></div>}<div><dt>Site</dt><dd>{websitePlatform === "wix" ? "Wix" : "WordPress"}</dd></div></dl>
          {selectedItem.last_error && <div className="publishing-detail-error"><strong>What needs attention</strong><p>{selectedItem.last_error}</p></div>}
          <div className="publishing-post-detail-actions">
            {state === "planned" && <a className="primary-button" href="#article-review-workspace">Generate article</a>}
            {state === "needs_review" && <a className="primary-button" href="#article-review-workspace">Review now</a>}
            {state === "scheduled" && selectedItem.remote_edit_url && <a className="primary-button" href={selectedItem.remote_edit_url} rel="noreferrer" target="_blank">View in WordPress ↗</a>}
            {state === "published" && selectedItem.remote_permalink && <a className="primary-button" href={selectedItem.remote_permalink} rel="noreferrer" target="_blank">View live post ↗</a>}
            {(state === "failed" || state === "missed") && <button className="primary-button" disabled={saving} onClick={() => void checkNow()} type="button">{saving ? "Checking…" : "Retry scheduling check"}</button>}
            {state === "manual" && <><a className="primary-button" href="#article-review-workspace">Copy article</a><a className="secondary-button" href="https://manage.wix.com/dashboard/" rel="noreferrer" target="_blank">Open Wix ↗</a></>}
          </div>
        </aside>;
      })()}

      <div className="publishing-plan-actions"><button className="secondary-button" onClick={() => setEditing(true)} type="button">Change mode or dates</button>{plan.status === "active" && plan.mode !== "review_each" && <button className="primary-button" disabled={saving} onClick={() => void checkNow()} type="button">{saving ? "Checking…" : "Run scheduling checks now"}</button>}<button className={plan.status === "paused" ? "primary-button" : "secondary-button"} disabled={saving} onClick={() => void setStatus(plan.status === "paused" ? "active" : "paused")} type="button">{saving ? "Saving…" : plan.status === "paused" ? "Resume scheduling" : "Pause new scheduling"}</button></div>
      <p className="publishing-plan-footnote">Destiny never publishes a missed date late. A missed or failed slot returns to review with a suggested new date.</p>
      {notice && <div className="integration-banner success" role="status"><strong>Scheduling check complete</strong><p>{notice}</p></div>}
      {error && <div className="error-banner" role="alert">{error}</div>}
    </> : null}
  </section>;
}
