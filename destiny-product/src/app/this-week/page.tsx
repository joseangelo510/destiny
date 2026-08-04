import { redirect } from "next/navigation";
import { CelebrationControls } from "@/components/celebration-controls";
import { WeeklyLoop } from "@/components/weekly-loop";
import { WorkspaceEmpty } from "@/components/workspace-empty";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getActionableCoachTasks, getCurrentCoachTask, groupCoachTasksForLoop } from "@/lib/product/coach-experience";
import { buildWeeklyProgressSummary } from "@/lib/quests/streak";
import { getWorkspaceContext } from "@/lib/workspace-context";

export default async function ThisWeekPage() {
  const context = await getWorkspaceContext();
  if (!context.website) redirect("/onboarding");
  if (!context.audit || context.audit.status !== "complete") {
    return <WorkspaceShell active="/this-week" eyebrow={context.website.normalized_domain} title="This week" description="Destiny turns your audit into one clear, guided checklist."><WorkspaceEmpty title="Your audit is still being prepared" description="Destiny will notify you when the evidence and weekly plan are ready." /></WorkspaceShell>;
  }
  const allTasks = context.quests.filter((task) => task.audit_id === context.audit?.id);
  const actionableTasks = getActionableCoachTasks(allTasks);
  const groups = groupCoachTasksForLoop(actionableTasks);
  const done = actionableTasks.filter((task) => task.status === "complete").length;
  const remainingTasks = actionableTasks.filter((task) => task.status !== "complete").length;
  const currentTask = getCurrentCoachTask(actionableTasks);
  const weekly = buildWeeklyProgressSummary(context.quests);
  return <WorkspaceShell active="/this-week" eyebrow={`${context.website.normalized_domain} · Week 1`} title="This week" description="Complete one useful task to maintain your weekly streak. Finish the full plan to earn a Perfect Week.">
    <WeeklyLoop auditId={context.audit.id} currentStreak={weekly.currentStreak} currentTaskId={currentTask?.id ?? null} groups={groups} remainingTasks={remainingTasks} />
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
