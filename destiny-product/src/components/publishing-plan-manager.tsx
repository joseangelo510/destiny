"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { buildWeeklySchedule, calendarLocalDateTimeAsUtc, editorialContentChannel, publishingCalendarState, reconcilePublishingItems, type EditorialContentChannel, type PublishingCalendarState, type PublishingMode, type PublishingPlanRecord, type PublishingScheduleItemRecord } from "@/lib/content/publishing-plan";
import { useWordPressCalendarReconciliation } from "./use-wordpress-calendar-reconciliation";

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

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const CONTENT_META: Record<EditorialContentChannel, { label: string; mark: string }> = {
  article: { label: "Article", mark: "A" },
  approved_draft: { label: "Approved draft", mark: "A" },
  linkedin: { label: "LinkedIn post", mark: "in" },
  x: { label: "X post", mark: "X" },
};

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

function weekStart(value: string) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function weekTitle(value: string) {
  const end = shiftDate(value, 6);
  const startDate = new Date(`${value}T12:00:00.000Z`);
  const endDate = new Date(`${end}T12:00:00.000Z`);
  const startLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(startDate);
  const endLabel = new Intl.DateTimeFormat("en-US", { month: startDate.getUTCMonth() === endDate.getUTCMonth() ? undefined : "short", day: "numeric", timeZone: "UTC" }).format(endDate);
  return `${startLabel}–${endLabel}`;
}

function calendarDateTime(value: string, timezone: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(value)).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
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

export function PublishingPlanManager({ websiteId, auditId, calendar, wordpressConnected, webflowConnected = false, approvedKeywordCount, websitePlatform, initialPlan, initialItems, now }: {
  websiteId: string;
  auditId: string;
  calendar: CalendarItem[];
  wordpressConnected: boolean;
  webflowConnected?: boolean;
  approvedKeywordCount: number;
  websitePlatform: string | null;
  initialPlan: PublishingPlanRecord | null;
  initialItems: PublishingScheduleItemRecord[];
  now?: string;
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
  const [viewMode, setViewMode] = useState<"month" | "week" | "list">("week");
  const [channel, setChannel] = useState<"all" | "articles" | "social">("all");
  const [currentMonth, setCurrentMonth] = useState(`${(initialPlan?.start_date ?? startDate).slice(0, 7)}-01`);
  const [currentWeek, setCurrentWeek] = useState(weekStart(initialItems[0]?.scheduled_for ?? initialPlan?.start_date ?? startDate));
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addType, setAddType] = useState<EditorialContentChannel>("article");
  const [addTitle, setAddTitle] = useState("");
  const [addKeyword, setAddKeyword] = useState("");
  const [addRelatedArticle, setAddRelatedArticle] = useState("");
  const [addDate, setAddDate] = useState(`${futureStartDate()}T09:00`);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles";
  const dates = useMemo(() => buildWeeklySchedule(startDate, calendar.length, timezone), [startDate, calendar.length, timezone]);
  const planTimezone = plan?.timezone || timezone;
  const displayState = (item: PublishingScheduleItemRecord) => publishingCalendarState(item, websitePlatform);
  const selectedItem = items.find((item) => item.id === selectedItemId) ?? null;
  const filteredItems = useMemo(() => items.filter((item) => {
    const itemChannel = editorialContentChannel(item.content_type);
    if (channel === "articles") return itemChannel === "article" || itemChannel === "approved_draft";
    if (channel === "social") return itemChannel === "linkedin" || itemChannel === "x";
    return true;
  }), [channel, items]);
  const articleTitles = useMemo(() => items.filter((item) => {
    const itemChannel = editorialContentChannel(item.content_type);
    return itemChannel === "article" || itemChannel === "approved_draft";
  }).map((item) => item.title), [items]);
  const calendarDays = useMemo(() => {
    const first = new Date(`${currentMonth}T12:00:00.000Z`);
    const mondayOffset = (first.getUTCDay() + 6) % 7;
    const start = new Date(first.getTime() - mondayOffset * 24 * 60 * 60 * 1000);
    const itemsByDate = filteredItems.reduce<Record<string, PublishingScheduleItemRecord[]>>((result, item) => {
      const key = dateKeyInTimezone(item.scheduled_for, planTimezone);
      result[key] = [...(result[key] ?? []), item];
      return result;
    }, {});
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start.getTime() + index * 24 * 60 * 60 * 1000);
      const key = date.toISOString().slice(0, 10);
      return { key, day: date.getUTCDate(), current: key.slice(0, 7) === currentMonth.slice(0, 7), items: itemsByDate[key] ?? [] };
    });
  }, [currentMonth, filteredItems, planTimezone]);
  const weekDays = useMemo(() => {
    const itemsByDate = filteredItems.reduce<Record<string, PublishingScheduleItemRecord[]>>((result, item) => {
      const key = dateKeyInTimezone(item.scheduled_for, planTimezone);
      result[key] = [...(result[key] ?? []), item];
      return result;
    }, {});
    return Array.from({ length: 7 }, (_, index) => {
      const key = shiftDate(currentWeek, index);
      return { key, date: new Date(`${key}T12:00:00.000Z`), items: itemsByDate[key] ?? [] };
    });
  }, [currentWeek, filteredItems, planTimezone]);
  const missingApprovals = approvedKeywordCount < 1;
  const manualCmsPlan = !wordpressConnected && (websitePlatform === "wix" || webflowConnected);
  const cmsUnavailable = !wordpressConnected && !manualCmsPlan;
  const availableModes = manualCmsPlan ? MODES.filter((option) => option.id !== "automatic") : MODES;
  const { needsVerification: needsWordPressVerification, overdueItems: overdueWordPressItems, refreshStatus: refreshWordPressStatus, verifyingItemId } = useWordPressCalendarReconciliation({
    websiteId, websitePlatform, wordpressConnected, now, items, setItems,
    onError: setError, onNotice: setNotice, onRefresh: router.refresh,
  });
  const displayMeta = (item: PublishingScheduleItemRecord) => {
    const state = displayState(item);
    return needsWordPressVerification(item)
      ? { ...STATE_META[state], label: "Scheduled — past due, not yet verified", short: "Verify", description: "The scheduled time passed. Ask WordPress whether this post is live." }
      : STATE_META[state];
  };

  useEffect(() => {
    const key = `destiny-publishing-view:${websiteId}`;
    const saved = window.localStorage.getItem(key);
    const nextView = saved === "month" || saved === "week" || saved === "list" ? saved : window.matchMedia("(max-width: 720px)").matches ? "list" : "week";
    const timer = window.setTimeout(() => setViewMode(nextView), 0);
    return () => window.clearTimeout(timer);
  }, [websiteId]);

  const chooseView = (value: "month" | "week" | "list") => {
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

  const addContent = async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/content/publishing-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteId,
          contentType: addType,
          title: addTitle,
          focusKeyword: addKeyword,
          relatedArticleTitle: addRelatedArticle,
          scheduledFor: calendarLocalDateTimeAsUtc(addDate, planTimezone),
        }),
      });
      const payload = await response.json() as { error?: string; item?: PublishingScheduleItemRecord };
      if (!response.ok || !payload.item) throw new Error(payload.error || "Destiny could not add this content.");
      setItems((current) => [...current, payload.item!].sort((left, right) => Date.parse(left.scheduled_for) - Date.parse(right.scheduled_for)));
      setAddOpen(false);
      setAddTitle("");
      setAddKeyword("");
      setAddRelatedArticle("");
      setNotice(`${CONTENT_META[addType].label} added to the calendar as planned.`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Destiny could not add this content.");
    } finally { setSaving(false); }
  };

  const openAddContent = (date?: string) => {
    if (date) setAddDate(`${date}T09:00`);
    setAddOpen(true);
  };

  const movePeriod = (amount: number) => {
    if (viewMode === "month") setCurrentMonth((value) => shiftMonth(value, amount));
    if (viewMode === "week") setCurrentWeek((value) => shiftDate(value, amount * 7));
  };

  const today = dateKeyInTimezone(new Date().toISOString(), planTimezone);

  return <section className="workspace-card publishing-plan" id="publishing-plan">
    <div className="publishing-plan-heading">
      <div><span className="eyebrow">{plan && !editing ? "Editorial calendar" : "Publishing plan"}</span><h2>{plan && !editing ? "Plan and publish your content." : "How involved do you want to be?"}</h2><p>{plan && !editing ? "See every blog article, LinkedIn post, and X post that is planned, waiting for review, scheduled, or published." : "Choose once for this plan. You can change it later without losing the calendar."}</p></div>
      {plan && !editing && <div className="publishing-heading-actions"><span className={`status-chip ${plan.status === "active" ? "" : "amber"}`}>{plan.status === "active" ? "Active" : plan.status === "paused" ? "Paused" : "Needs attention"}</span><button className="primary-button" onClick={() => setAddOpen(true)} type="button">+ Add content</button></div>}
    </div>
    {missingApprovals ? <div className="configuration-note"><strong>Approve topics before scheduling</strong><p>Only explicitly approved keyword topics can enter a publishing plan. Review the Keyword strategy first.</p></div>
      : manualCmsPlan ? <div className="configuration-note"><strong>{websitePlatform === "wix" ? "Wix" : "Webflow"} uses a guided publishing plan</strong><p>Destiny will save every date and article task here. You will finish each publication in {websitePlatform === "wix" ? "Wix" : "Webflow"}; nothing is labeled scheduled or live until the CMS confirms it.</p></div>
      : cmsUnavailable ? <div className="configuration-note"><strong>Connect a CMS before scheduling</strong><p>Destiny can save reviewed content after WordPress or Webflow is connected. Wix websites can use the guided manual plan.</p></div> : null}
    {editing ? <>
      <div className="publishing-mode-grid" role="radiogroup" aria-label="Publishing mode">
        {availableModes.map((option) => <button aria-checked={mode === option.id} className={mode === option.id ? "active" : ""} key={option.id} onClick={() => { setMode(option.id); setAutomaticConfirmed(false); }} role="radio" type="button"><small>{option.note}</small><strong>{option.title}</strong><span>{option.description}</span></button>)}
      </div>
      <div className="publishing-date-row"><label>First publication date<input min={futureStartDate()} type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><div><small>Three-month range</small><strong>{dates.length ? `${new Date(dates[0]).toLocaleDateString()} – ${new Date(dates.at(-1)!).toLocaleDateString()}` : "Choose a start date"}</strong><span>{calendar.length} weekly posts · at least 72 hours before each date</span></div></div>
      {mode === "automatic" && !manualCmsPlan && <label className="automatic-confirmation"><input checked={automaticConfirmed} onChange={(event) => setAutomaticConfirmed(event.target.checked)} type="checkbox" /><span><strong>Confirm automatic scheduling for {calendar.length} posts</strong><small>Destiny may schedule these dates only after every article passes its quality checks. The first two posts will be marked “review recommended.” Failures stop instead of publishing.</small></span></label>}
      {error && <div className="error-banner" role="alert">{error}</div>}
      <div className="publishing-plan-actions"><button className="primary-button" disabled={!mode || saving || missingApprovals || cmsUnavailable || (mode === "automatic" && !automaticConfirmed)} onClick={() => void save()} type="button">{saving ? "Saving plan…" : plan ? "Save changes" : "Start this publishing plan"}</button>{plan && <button className="secondary-button" disabled={saving} onClick={() => { setEditing(false); setMode(plan.mode); }} type="button">Cancel</button>}</div>
    </> : plan ? <>
      {overdueWordPressItems.length > 0 && <div className="configuration-note amber"><strong>{overdueWordPressItems.length === 1 ? "One WordPress post needs a status check" : `${overdueWordPressItems.length} WordPress posts need a status check`}</strong><p>The scheduled time passed, but Destiny has not verified the public page yet.</p><div className="publishing-plan-actions">{overdueWordPressItems.map((item) => <button className="secondary-button" disabled={Boolean(verifyingItemId)} key={item.id} onClick={() => void refreshWordPressStatus(item)} type="button">{verifyingItemId === item.id ? "Checking…" : "Refresh WordPress status"}</button>)}</div></div>}
      <div className="publishing-calendar-toolbar">
        <div className="publishing-toolbar-left">
          <div aria-label="Editorial calendar view" className="publishing-view-toggle" role="group">
            <button aria-pressed={viewMode === "month"} onClick={() => chooseView("month")} type="button">Month</button>
            <button aria-pressed={viewMode === "week"} onClick={() => chooseView("week")} type="button">Week</button>
            <button aria-pressed={viewMode === "list"} onClick={() => chooseView("list")} type="button">List</button>
          </div>
          {viewMode !== "list" && <div className="publishing-month-controls">
            <button aria-label={`Previous ${viewMode}`} onClick={() => movePeriod(-1)} type="button">←</button>
            <strong>{viewMode === "month" ? monthTitle(currentMonth) : weekTitle(currentWeek)}</strong>
            <button onClick={() => { setCurrentMonth(`${today.slice(0, 7)}-01`); setCurrentWeek(weekStart(today)); }} type="button">Today</button>
            <button aria-label={`Next ${viewMode}`} onClick={() => movePeriod(1)} type="button">→</button>
          </div>}
        </div>
        <div aria-label="Content channel" className="publishing-channel-toggle" role="group"><button aria-pressed={channel === "all"} onClick={() => setChannel("all")} type="button">All</button><button aria-pressed={channel === "articles"} onClick={() => setChannel("articles")} type="button">Articles</button><button aria-pressed={channel === "social"} onClick={() => setChannel("social")} type="button">Social</button></div>
      </div>

      <div className={`publishing-calendar-layout${selectedItem ? " has-detail" : ""}`}>
        <div className="publishing-calendar-main">
          {viewMode === "month" && <div aria-label="Publishing month view" className="publishing-calendar-view publishing-month-view">
            <div className="publishing-calendar-weekdays">{WEEKDAYS.map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
            <div className="publishing-calendar-grid">
              {calendarDays.map((day) => <div className={`publishing-calendar-day${day.current ? "" : " muted"}`} key={day.key}>
                <time dateTime={day.key}>{day.day}</time>
                <div className="publishing-calendar-day-items">{day.items.slice(0, 2).map((item) => {
                  const state = displayState(item);
                  const meta = displayMeta(item);
                  const content = CONTENT_META[editorialContentChannel(item.content_type)];
                  return <button aria-label={`${item.title}: ${meta.label}`} className={`publishing-calendar-card ${state}`} key={item.id} onClick={() => setSelectedItemId(item.id)} type="button"><span className="publishing-card-type"><b>{content.mark}</b>{content.label}<i aria-hidden="true" /></span><strong>{item.title}</strong></button>;
                })}{day.items.length > 2 && <button className="publishing-calendar-more" onClick={() => { setCurrentWeek(weekStart(day.key)); chooseView("week"); }} type="button">+{day.items.length - 2} more</button>}</div>
              </div>)}
            </div>
            {!calendarDays.some((day) => day.current && day.items.length) && <div className="publishing-calendar-empty"><strong>No content planned for {monthTitle(currentMonth)}</strong><button onClick={() => openAddContent(currentMonth)} type="button">Add content</button></div>}
          </div>}

          {viewMode === "week" && <div aria-label="Publishing week view" className="publishing-week-view">{weekDays.map((day) => <section className={`publishing-week-day${day.key === today ? " today" : ""}`} key={day.key}><div className="publishing-week-heading"><strong>{new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" }).format(day.date)}</strong><span>{day.key === today ? "Today · " : ""}{day.items.length ? `${day.items.length} content item${day.items.length === 1 ? "" : "s"}` : "No content planned"}</span></div>{day.items.length ? <div className="publishing-week-items">{day.items.map((item) => {
            const state = displayState(item);
            const meta = displayMeta(item);
            const content = CONTENT_META[editorialContentChannel(item.content_type)];
            return <button className="publishing-week-row" key={item.id} onClick={() => setSelectedItemId(item.id)} type="button"><span className="publishing-week-type"><b>{content.mark}</b><span><strong>{content.label}</strong><small>{new Intl.DateTimeFormat("en-US", { timeZone: planTimezone, hour: "numeric", minute: "2-digit" }).format(new Date(item.scheduled_for))}</small></span></span><span className="publishing-week-title"><strong>{item.title}</strong><small>{item.related_article_title ? `Promotes article: “${item.related_article_title}”` : `Focus keyword: ${item.keyword}`}</small></span><span className={`publishing-detail-status ${state}`}>{meta.icon} {meta.label}</span></button>;
          })}</div> : <div className="publishing-week-empty"><span>This day is open.</span><button onClick={() => openAddContent(day.key)} type="button">+ Add content</button></div>}</section>)}</div>}

          {viewMode === "list" && <div aria-label="Publishing list view" className="publishing-list-view"><div className="publishing-list-heading"><strong>{new Date(`${plan.start_date}T12:00:00Z`).toLocaleDateString()} – {new Date(`${plan.end_date}T12:00:00Z`).toLocaleDateString()}</strong><small>{filteredItems.length} content items · Times shown in {planTimezone}</small></div><div className="publishing-list-head"><span>Date</span><span>Type</span><span>Title</span><span>Related article</span><span>Status</span><span>Action</span></div>{filteredItems.map((item) => {
            const state = displayState(item);
            const meta = displayMeta(item);
            const content = CONTENT_META[editorialContentChannel(item.content_type)];
            return <button className="publishing-list-row" key={item.id} onClick={() => setSelectedItemId(item.id)} type="button"><time>{formattedPublishTime(item.scheduled_for, planTimezone)}</time><span className="publishing-list-type"><b>{content.mark}</b>{content.label}</span><span><strong>{item.title}</strong><small>{item.review_recommended ? "Review recommended" : item.keyword}</small></span><span>{item.related_article_title || "Not applicable"}</span><span className={`publishing-detail-status ${state}`}>{meta.icon} {meta.label}</span><span className="publishing-list-action">{state === "needs_review" ? "Review" : state === "published" ? "View live" : state === "scheduled" ? "Open" : "View"}</span></button>;
          })}</div>}

          <div aria-label="Publishing state legend" className="publishing-calendar-legend">{(["planned", "needs_review", "scheduled", "published", "failed", ...(manualCmsPlan ? ["manual"] : [])] as PublishingCalendarState[]).map((state) => <span className={state} key={state}><i aria-hidden="true" />{state === "failed" ? "Failed / missed" : STATE_META[state].label}</span>)}</div>
        </div>

        {selectedItem && (() => {
          const state = displayState(selectedItem);
          const meta = displayMeta(selectedItem);
          const content = CONTENT_META[editorialContentChannel(selectedItem.content_type)];
          const social = editorialContentChannel(selectedItem.content_type) === "linkedin" || editorialContentChannel(selectedItem.content_type) === "x";
          return <aside aria-label="Content details" aria-modal="false" className="publishing-post-detail" role="dialog">
            <div className="publishing-post-detail-heading"><div><span className="eyebrow">Content details</span><h3>{selectedItem.title}</h3></div><button aria-label="Close content details" onClick={() => setSelectedItemId(null)} type="button">×</button></div>
            <span className={`publishing-detail-status ${state}`}>{meta.icon} {meta.label}</span>
            <p>Review this {content.label.toLocaleLowerCase()}, check its publishing status, and open the next action.</p>
            <dl><div><dt>Content type</dt><dd>{content.label}</dd></div><div><dt>Publish time</dt><dd>{formattedPublishTime(selectedItem.scheduled_for, planTimezone)}</dd></div>{selectedItem.related_article_title ? <div><dt>Related article</dt><dd>{selectedItem.related_article_title}</dd></div> : <div><dt>Focus keyword</dt><dd>{selectedItem.keyword}</dd></div>}{selectedItem.remote_id && <div><dt>CMS post ID</dt><dd>{selectedItem.remote_id}</dd></div>}<div><dt>Destination</dt><dd>{social ? content.label.replace(" post", "") : websitePlatform === "wix" ? "Wix" : webflowConnected ? "Webflow" : "WordPress"}</dd></div></dl>
            {selectedItem.last_error && <div className="publishing-detail-error"><strong>What needs attention</strong><p>{selectedItem.last_error}</p></div>}
            <div className="publishing-post-detail-actions">
              {state === "planned" && <a className="primary-button" href={social ? "/distribution" : "#article-review-workspace"}>{social ? "Prepare social post" : "Generate article"}</a>}
              {state === "needs_review" && <a className="primary-button" href={social ? "/distribution" : "#article-review-workspace"}>Review content</a>}
              {state === "scheduled" && selectedItem.remote_edit_url && <a className="primary-button" href={selectedItem.remote_edit_url} rel="noreferrer" target="_blank">View in WordPress ↗</a>}
              {needsWordPressVerification(selectedItem) && <button className="secondary-button" disabled={Boolean(verifyingItemId)} onClick={() => void refreshWordPressStatus(selectedItem)} type="button">{verifyingItemId === selectedItem.id ? "Checking…" : "Refresh WordPress status"}</button>}
              {state === "published" && selectedItem.remote_permalink && <a className="primary-button" href={selectedItem.remote_permalink} rel="noreferrer" target="_blank">View live post ↗</a>}
              {(state === "failed" || state === "missed") && <button className="primary-button" disabled={saving} onClick={() => void checkNow()} type="button">{saving ? "Checking…" : "Retry scheduling check"}</button>}
              {state === "manual" && <><a className="primary-button" href="#article-review-workspace">Prepare article</a><a className="secondary-button" href={websitePlatform === "wix" ? "https://manage.wix.com/dashboard/" : "https://webflow.com/dashboard"} rel="noreferrer" target="_blank">Open {websitePlatform === "wix" ? "Wix" : "Webflow"} ↗</a></>}
            </div>
          </aside>;
        })()}
      </div>

      {addOpen && <div className="publishing-add-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) setAddOpen(false); }}><div aria-labelledby="publishing-add-title" aria-modal="true" className="publishing-add-dialog" role="dialog"><div className="publishing-add-heading"><div><h3 id="publishing-add-title">Add content to your calendar</h3><p>Choose what to add. Create something new or schedule a draft you already approved.</p></div><button aria-label="Close add content" onClick={() => setAddOpen(false)} type="button">×</button></div><div aria-label="Content type" className="publishing-add-types" role="group">{(["article", "linkedin", "x", "approved_draft"] as EditorialContentChannel[]).map((type) => <button aria-pressed={addType === type} key={type} onClick={() => setAddType(type)} type="button">{CONTENT_META[type].label}</button>)}</div><div className="publishing-add-form"><label className="wide">Content title<input onChange={(event) => setAddTitle(event.target.value)} placeholder={addType === "linkedin" ? "What should this LinkedIn post say?" : addType === "x" ? "What should this X post say?" : "Enter the article title"} value={addTitle} /></label>{addType === "article" || addType === "approved_draft" ? <label>Focus keyword<input onChange={(event) => setAddKeyword(event.target.value)} placeholder="e.g. YouTube SEO services" value={addKeyword} /></label> : <label>Article this post promotes<select onChange={(event) => setAddRelatedArticle(event.target.value)} value={addRelatedArticle}><option value="">Choose an article</option>{articleTitles.map((title) => <option key={title} value={title}>{title}</option>)}</select></label>}<label>Publish or schedule date<input min={calendarDateTime(new Date().toISOString(), timezone)} onChange={(event) => setAddDate(event.target.value)} type="datetime-local" value={addDate} /></label></div>{error && <div className="error-banner" role="alert">{error}</div>}<div className="publishing-add-actions"><button className="secondary-button" onClick={() => setAddOpen(false)} type="button">Cancel</button><button className="primary-button" disabled={saving || !addTitle.trim() || !addDate || ((addType === "article" || addType === "approved_draft") ? !addKeyword.trim() : !addRelatedArticle)} onClick={() => void addContent()} type="button">{saving ? "Adding…" : "Add as planned"}</button></div></div></div>}

      <div className="publishing-plan-actions"><button className="secondary-button" onClick={() => setEditing(true)} type="button">Change mode or dates</button>{wordpressConnected && plan.status === "active" && plan.mode !== "review_each" && <button className="primary-button" disabled={saving} onClick={() => void checkNow()} type="button">{saving ? "Checking…" : "Run scheduling checks now"}</button>}<button className={plan.status === "paused" ? "primary-button" : "secondary-button"} disabled={saving} onClick={() => void setStatus(plan.status === "paused" ? "active" : "paused")} type="button">{saving ? "Saving…" : plan.status === "paused" ? "Resume scheduling" : "Pause new scheduling"}</button></div>
      <p className="publishing-plan-footnote">Destiny never publishes a missed date late. A missed or failed slot returns to review with a suggested new date.</p>
      {notice && <div className="integration-banner success" role="status"><strong>Scheduling check complete</strong><p>{notice}</p></div>}
      {error && <div className="error-banner" role="alert">{error}</div>}
    </> : null}
  </section>;
}
