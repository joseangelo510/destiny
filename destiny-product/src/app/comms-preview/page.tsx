import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WeekIndicator } from "@/components/week-indicator";
import { WorkspaceShell } from "@/components/workspace-shell";
import { renderContinuityEmail, renderOnboardingDataLandedEmail, renderWeeklyScorecardEmail } from "@/lib/comms/email-templates";
import { buildScorecardSnapshot } from "@/lib/comms/scorecard";
import { createWeekContinuity } from "@/lib/comms/week";
import type { ScorecardMetric, ScorecardWin } from "@/lib/comms/contracts";
import { isStreakActionableTask } from "@/lib/quests/completion";
import { buildWeeklyProgressSummary } from "@/lib/quests/streak";
import { getWorkspaceContext } from "@/lib/workspace-context";
import { siteScopedHref } from "@/lib/workspace-selection";
import styles from "./preview.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Comms beta preview — Destiny", description: "Review Destiny's beta email and in-app communication surfaces." };

function metric(key: string, label: string, value: number | null | undefined): ScorecardMetric | null {
  if (value === null || value === undefined) return null;
  return { key, label, value: new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value), delta: null, direction: "unknown", sparkline: [value] };
}

function EmailPreview({ html, title }: { html: string; title: string }) {
  return <article className={styles.emailPreview}><header><strong>{title}</strong><span>375px / 600px responsive</span></header><iframe srcDoc={html} title={`${title} email preview`} /></article>;
}

export default async function CommsPreviewPage() {
  const context = await getWorkspaceContext();
  if (!context.website) redirect("/onboarding");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const weekly = await buildWeeklyProgressSummary(context.quests);
  const actionable = context.quests.filter((task) => isStreakActionableTask(task.task_type));
  const completed = actionable.filter((task) => task.status === "complete");
  const nextTask = actionable.find((task) => task.status !== "complete");
  const { data: preference } = await context.supabase.from("comms_preferences").select("user_timezone,cadence,email_enabled,push_enabled").eq("website_id", context.website.id).eq("user_id", context.userId).maybeSingle();
  const timezone = preference?.user_timezone || "UTC";
  const continuity = createWeekContinuity(new Date(), timezone, { streakLength: weekly.currentStreak, freezesRemaining: 2, freezesResetAt: new Date(0).toISOString() });
  const metrics = [
    metric("ranking-keywords", "Ranking keywords", context.metrics?.ranking_keywords),
    metric("organic-traffic", "Estimated organic traffic", Number(context.metrics?.estimated_organic_traffic ?? 0)),
    metric("critical-issues", "Critical issues", context.metrics?.critical_issues),
    metric("referring-domains", "Referring domains", context.metrics?.referring_domains),
  ].filter((item): item is ScorecardMetric => Boolean(item));
  const wins: ScorecardWin[] = completed.slice(0, 3).map((task) => ({
    objectName: task.title,
    objectUrl: siteScopedHref(task.action_path, context.website?.id),
    from: "Open",
    to: task.verification_status === "verified" ? "Verified" : "Marked done",
    metric: `${task.estimated_minutes} min useful step`,
  }));
  const source = {
    accountId: context.website.organization_id,
    websiteId: context.website.id,
    messageId: `scorecard:${context.website.id}:${continuity.localWeekStart}`,
    weekNumber: continuity.weekNumber,
    streakLength: weekly.currentStreak,
    weekState: (completed.length > 0 ? "completed" : "open") as "completed" | "open",
    freezesRemaining: continuity.freezesRemaining,
    metrics,
    wins,
    attention: nextTask ? [{
      problem: nextTask.title,
      cause: "This is the first actionable item still open in the saved Week.",
      fix: nextTask.description,
      timeCostMinutes: Math.max(1, nextTask.estimated_minutes),
      deepLink: siteScopedHref(nextTask.action_path, context.website.id),
    }] : [],
    cta: {
      label: nextTask ? "Continue this Week" : "Review completed work",
      deepLink: siteScopedHref(nextTask?.action_path || "/this-week", context.website.id),
      timeCostMinutes: Math.max(1, nextTask?.estimated_minutes || 5),
    },
    nextWeek: { weekNumber: continuity.weekNumber + 1, actionsRequired: 1, timeCostMinutes: Math.max(1, nextTask?.estimated_minutes || 15) },
  };
  const full = buildScorecardSnapshot({ ...source, forceVariant: "full" });
  const thin = buildScorecardSnapshot({ ...source, forceVariant: "thin", wins: [] });
  const first = buildScorecardSnapshot({ ...source, forceVariant: "first", wins: [], isFirstScorecard: true });
  const websiteName = context.website.business_name?.trim() || context.website.normalized_domain;

  return <WorkspaceShell active="/comms-preview" eyebrow={`${context.website.normalized_domain} · review only`} title="Communications beta preview" description="These mockups use the active website's saved metrics and tasks. Nothing on this page sends an email or push notification.">
    <section className={styles.section}>
      <div className={styles.sectionHeading}><span>Email</span><h2>Six minimum beta compositions</h2><p>Every scorecard value and link below comes from the active Destiny workspace payload.</p></div>
      <div className={styles.emailGrid}>
        <EmailPreview html={renderWeeklyScorecardEmail(full, appUrl)} title="Weekly Scorecard — full" />
        <EmailPreview html={renderWeeklyScorecardEmail(thin, appUrl)} title="Weekly Scorecard — thin" />
        <EmailPreview html={renderWeeklyScorecardEmail(first, appUrl)} title="Weekly Scorecard — first" />
        <EmailPreview html={renderContinuityEmail({ appUrl, kind: "friday-risk", minutes: source.cta.timeCostMinutes, streakLength: weekly.currentStreak, websiteName })} title="Friday Week at risk" />
        <EmailPreview html={renderContinuityEmail({ appUrl, kind: "sunday-last-chance", minutes: source.cta.timeCostMinutes, streakLength: weekly.currentStreak, websiteName })} title="Sunday last chance" />
        <EmailPreview html={renderOnboardingDataLandedEmail({ appUrl, achievementName: "First useful step", minutes: source.cta.timeCostMinutes, websiteName })} title="Onboarding 2 — first data landed" />
      </div>
    </section>
    <section className={styles.section}>
      <div className={styles.sectionHeading}><span>In app</span><h2>Four minimum beta surfaces</h2><p>The indicator states share one component; the saved preference and batch row use the same contract as the APIs.</p></div>
      <div className={styles.indicatorStack}>
        <WeekIndicator freezesRemaining={2} state="completed" streakLength={weekly.currentStreak} />
        <WeekIndicator freezesRemaining={2} state="at_risk" streakLength={weekly.currentStreak} />
        <WeekIndicator freezesRemaining={1} state="frozen" streakLength={weekly.currentStreak} />
      </div>
      <div className={styles.inAppGrid}>
        <article className={styles.inAppSurface}><span className={styles.kicker}>Day zero</span><div className={styles.achievement}><b>⌁</b><p><strong>First useful step</strong><small>Achievement earned after the first actionable quest.</small></p></div></article>
        <article className={styles.inAppSurface}><span className={styles.kicker}>Cadence</span><h3>{preference?.cadence || "weekly"}</h3><p>{timezone} · Email {preference?.email_enabled === false ? "off" : "on"} · Push {preference?.push_enabled ? "on" : "off"}</p><a href={siteScopedHref("/account#communication-cadence", context.website.id)}>Change cadence</a></article>
        <article className={styles.inAppSurface}><span className={styles.kicker}>Batched row</span><div className={styles.batchRow}><b>{Math.max(completed.length, 0)}</b><p><strong>{completed.length ? `${completed.length} useful updates this Week` : "No grouped updates yet"}</strong><small>{completed[0]?.title || "Completed actions will group here without inbox noise."}</small></p><span>›</span></div></article>
      </div>
    </section>
  </WorkspaceShell>;
}
