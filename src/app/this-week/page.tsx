import Link from "next/link";
import { redirect } from "next/navigation";
import { CelebrationControls } from "@/components/celebration-controls";
import { CompassCompanion } from "@/components/compass-companion";
import { WeeklyTaskList } from "@/components/weekly-task-list";
import { WorkspaceEmpty } from "@/components/workspace-empty";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getActionableCoachTasks, groupCoachTasks } from "@/lib/product/coach-experience";
import { buildSeoRoadmap, type RoadmapAnalytics, type RoadmapSearchConsole } from "@/lib/product/roadmap";
import { buildWeeklyProgressSummary } from "@/lib/quests/streak";
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
  const actionableTasks = getActionableCoachTasks(allTasks);
  const groups = groupCoachTasks(actionableTasks);
  const done = actionableTasks.filter((task) => task.status === "complete").length;
  const remainingTasks = actionableTasks.filter((task) => task.status !== "complete").length;
  const weekly = buildWeeklyProgressSummary(context.quests);
  const roadmap = buildSeoRoadmap({
    auditComplete: true,
    quests: context.quests,
    searchConsole: connectedMetadata(context, "google_search_console") as RoadmapSearchConsole | null,
    analytics: connectedMetadata(context, "google_analytics") as RoadmapAnalytics | null,
  });
  const perfectWeek = actionableTasks.length > 0 && done === actionableTasks.length;
  return <WorkspaceShell active="/this-week" eyebrow={`${context.website.normalized_domain} · Week 1`} title="Your SEO plan for this week" description="Complete one useful task to maintain your weekly streak. Finish the full plan to earn a Perfect Week.">
    <section className={`weekly-progress-card ${perfectWeek ? "perfect" : ""}`}><div><span>{done} of {actionableTasks.length} tasks complete</span><strong>{perfectWeek ? "Perfect Week complete" : "One category at a time"}</strong><p>{perfectWeek ? "Every assigned task is complete. Destiny will use completed and verified evidence to shape the next weekly loop." : "Start with research and strategy, then move into content, distribution, and measurement."}</p><div className="weekly-progress-actions"><Link className="text-button" href="/roadmap">Open roadmap</Link><Link className="text-button" href="/analytics">Review verified results</Link></div></div><div className="weekly-progress-ring"><strong>{actionableTasks.length ? Math.round((done / actionableTasks.length) * 100) : 0}%</strong><span>done</span></div><CompassCompanion compact completed={roadmap.completedCount} total={roadmap.nodes.length} /></section>
    <section className="weekly-momentum-grid" aria-label="Weekly streak and completion history">{[
      [weekly.currentStreak, "Current streak", "Complete one task this week to keep it going"],
      [weekly.bestStreak, "Best streak", "Your longest saved weekly run"],
      [weekly.perfectWeeks, "Perfect Weeks", "Every assigned task completed"],
      [weekly.lifetimeActiveWeeks, "Lifetime active weeks", "Weeks where you completed useful work"],
    ].map(([value, label, detail]) => <article key={String(label)}><strong>{Number(value)}</strong><span>{label}</span><small>{detail}</small></article>)}</section>
    <div className="coach-category-stack">{groups.map((group, index) => <section className="coach-task-category" id={group.id} key={group.id}><div className="coach-category-heading"><span>{index + 1}</span><div><h2>{group.label}</h2><p>{group.description}</p></div><strong>{group.tasks.filter((task) => task.status === "complete").length} / {group.tasks.length}</strong></div><WeeklyTaskList remainingTasks={remainingTasks} tasks={group.tasks} /></section>)}</div>
    <CelebrationControls />
  </WorkspaceShell>;
}
