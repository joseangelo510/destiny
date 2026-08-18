"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { buildWeeklySchedule, reconcilePublishingItems, type PublishingMode, type PublishingPlanRecord, type PublishingScheduleItemRecord } from "@/lib/content/publishing-plan";

type CalendarItem = { focusKeyword: string; title: string; contentType: string };

const MODES: Array<{ id: PublishingMode; title: string; description: string; note: string }> = [
  { id: "review_each", title: "Review each article", description: "Destiny creates WordPress drafts. You approve each article before choosing its date.", note: "Most control" },
  { id: "batch_schedule", title: "Approve and schedule in a batch", description: "Review several finished articles, approve them together, and schedule the selected posts.", note: "Balanced" },
  { id: "automatic", title: "Publish automatically", description: "Destiny schedules articles that pass every quality check. Anything uncertain stops for review.", note: "Most hands-off" },
];

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
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles";
  const dates = useMemo(() => buildWeeklySchedule(startDate, calendar.length, timezone), [startDate, calendar.length, timezone]);
  const counts = useMemo(() => items.reduce<Record<string, number>>((result, item) => ({ ...result, [item.state]: (result[item.state] ?? 0) + 1 }), {}), [items]);
  const missingApprovals = approvedKeywordCount < 1;
  const wixUnsupported = websitePlatform === "wix" && !wordpressConnected;
  const cmsUnavailable = !wordpressConnected;

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
      <div className="publishing-plan-actions"><button className="secondary-button" onClick={() => setEditing(true)} type="button">Change mode or dates</button>{plan.status === "active" && plan.mode !== "review_each" && <button className="primary-button" disabled={saving} onClick={() => void checkNow()} type="button">{saving ? "Checking…" : "Run scheduling checks now"}</button>}<button className={plan.status === "paused" ? "primary-button" : "secondary-button"} disabled={saving} onClick={() => void setStatus(plan.status === "paused" ? "active" : "paused")} type="button">{saving ? "Saving…" : plan.status === "paused" ? "Resume scheduling" : "Pause new scheduling"}</button></div>
      <ol className="publishing-queue-preview">{items.slice(0, 4).map((item) => <li key={item.id}><span>{item.position}</span><div><strong>{item.title}</strong><small>{new Date(item.scheduled_for).toLocaleDateString()} · {item.state.replaceAll("_", " ")}{item.review_recommended ? " · review recommended" : ""}</small>{item.last_error && <em>{item.last_error}</em>}</div></li>)}</ol>
      <p className="publishing-plan-footnote">Destiny never publishes a missed date late. A missed or failed slot returns to review with a suggested new date.</p>
      {notice && <div className="integration-banner success" role="status"><strong>Scheduling check complete</strong><p>{notice}</p></div>}
      {error && <div className="error-banner" role="alert">{error}</div>}
    </> : null}
  </section>;
}
