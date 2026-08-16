import { redirect } from "next/navigation";
import { CelebrationControls } from "@/components/celebration-controls";
import { PausedWorkList } from "@/components/paused-work-list";
import { DiscoveryMomentCard, FounderWhyVault, WitnessLog } from "@/components/founder-journey";
import { WeeklyLoop } from "@/components/weekly-loop";
import { WorkspaceEmpty } from "@/components/workspace-empty";
import { WorkspaceShell } from "@/components/workspace-shell";
import { WeekIndicator } from "@/components/week-indicator";
import { buildCoachTaskSet } from "@/lib/product/coach-experience";
import { buildWitnessLog, selectDiscoveryMoment } from "@/lib/product/founder-journey";
import { buildWeeklyProgressSummary } from "@/lib/quests/streak";
import { advanceWeek, createWeekContinuity } from "@/lib/comms/week";
import type { WeekState } from "@/lib/comms/contracts";
import { isCommsBetaEnabled } from "@/lib/comms/feature";
import { getWorkspaceContext, record } from "@/lib/workspace-context";

function connectedMetadata(context: Awaited<ReturnType<typeof getWorkspaceContext>>, provider: string) {
  const integration = context.integrations.find((item) => item.provider === provider && item.status === "connected" && item.last_synced_at);
  return integration ? record(integration.metadata) : null;
}

export default async function ThisWeekPage() {
  const context = await getWorkspaceContext();
  if (!context.website) redirect("/onboarding");
  if (!context.audit || context.audit.status !== "complete") {
    return <WorkspaceShell active="/this-week" eyebrow={context.website.normalized_domain} title="This week" description="Destiny turns your audit into one clear, guided checklist."><WorkspaceEmpty title="Your audit is still being prepared" description="Destiny will notify you when the evidence and weekly plan are ready." /></WorkspaceShell>;
  }
  const allTasks = context.quests.filter((task) => task.audit_id === context.audit?.id);
  const coach = await buildCoachTaskSet(allTasks);
  const actionableTasks = coach.actionable;
  const groups = coach.loopGroups;
  const done = actionableTasks.filter((task) => task.status === "complete").length;
  const remainingTasks = actionableTasks.filter((task) => task.status !== "complete").length;
  const currentTask = coach.currentTask;
  const weekly = await buildWeeklyProgressSummary(context.quests);
  let weekIndicator = null;
  if (isCommsBetaEnabled()) {
    const { data: preference } = await context.supabase.from("comms_preferences").select("user_timezone").eq("website_id", context.website.id).eq("user_id", context.userId).maybeSingle();
    const derivedWeek = createWeekContinuity(new Date(), preference?.user_timezone || "UTC", { streakLength: weekly.currentStreak, freezesRemaining: 2, freezesResetAt: new Date(0).toISOString() });
    const { data: savedWeek } = await context.supabase.from("comms_weeks").select("state,streak_length,freezes_remaining").eq("website_id", context.website.id).eq("user_id", context.userId).eq("local_week_start", derivedWeek.localWeekStart).maybeSingle();
    const advancedWeek = advanceWeek(derivedWeek, new Date()).continuity;
    const displayWeek = {
      state: (savedWeek?.state ?? advancedWeek.state) as WeekState,
      streakLength: savedWeek?.streak_length ?? advancedWeek.streakLength,
      freezesRemaining: savedWeek?.freezes_remaining ?? advancedWeek.freezesRemaining,
    };
    const { data: firstStep } = await context.supabase.from("comms_achievements").select("id").eq("website_id", context.website.id).eq("user_id", context.userId).eq("achievement_key", "first_useful_step").maybeSingle();
    weekIndicator = <WeekIndicator achievementEarned={Boolean(firstStep)} freezesRemaining={displayWeek.freezesRemaining} state={displayWeek.state} streakLength={displayWeek.streakLength} />;
  }
  const searchConsole = connectedMetadata(context, "google_search_console");
  const analytics = connectedMetadata(context, "google_analytics");
  const discoveryMoment = selectDiscoveryMoment({
    organicKeyEvents: analytics?.organicKeyEvents,
    searchClicks: searchConsole?.clicks,
    searchImpressions: searchConsole?.impressions,
  });
  const witnessEntries = buildWitnessLog({
    auditComplete: context.audit.status === "complete",
    analytics,
    quests: allTasks,
    searchConsole,
  });
  return <WorkspaceShell active="/this-week" eyebrow={`${context.website.normalized_domain} · Week 1`} title="This week" description="Complete one useful task to maintain your weekly streak. Finish the full plan to earn a Perfect Week.">
    {weekIndicator}
    <DiscoveryMomentCard moment={discoveryMoment} />
    <WeeklyLoop auditId={context.audit.id} currentStreak={weekly.currentStreak} currentTaskId={currentTask?.id ?? null} groups={groups} remainingTasks={remainingTasks} />
    <PausedWorkList tasks={coach.pausedTasks} />
    <WitnessLog entries={witnessEntries} />
    <FounderWhyVault initialWhy={context.profile?.founder_why ?? ""} />
    <details className="weekly-momentum-drawer">
      <summary><span><strong>Your momentum</strong><small>{weekly.currentStreak}-week streak · {done} of {actionableTasks.length} complete</small></span><b>View history</b></summary>
      <section className="weekly-momentum-grid" aria-label="Weekly streak and completion history">{[
        [weekly.currentStreak, "Current streak", "Complete one task this week to keep it going"],
        [weekly.bestStreak, "Best streak", "Your longest saved weekly run"],
        [weekly.perfectWeeks, "Perfect Weeks", "Every assigned task completed"],
        [weekly.lifetimeActiveWeeks, "Lifetime active weeks", "Weeks where you completed useful work"],
      ].map(([value, label, detail]) => <article key={String(label)}><strong>{Number(value)}</strong><span>{label}</span><small>{detail}</small></article>)}</section>
    </details>
    <CelebrationControls />
  </WorkspaceShell>;
}
