import Link from "next/link";
import { redirect } from "next/navigation";
import { WeeklyTaskList } from "@/components/weekly-task-list";
import { WorkspaceEmpty } from "@/components/workspace-empty";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getActionableCoachTasks, groupCoachTasks } from "@/lib/product/coach-experience";
import { getWorkspaceContext } from "@/lib/workspace-context";

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
  return <WorkspaceShell active="/this-week" eyebrow={`${context.website.normalized_domain} · Week 1`} title="Your SEO plan for this week" description="Work through four clear categories: research and strategy, content creation, distribution, and data analysis.">
    <section className="weekly-progress-card"><div><span>{done} of {actionableTasks.length} tasks complete</span><strong>{done === actionableTasks.length ? "Your weekly plan is complete" : "One category at a time"}</strong><p>{done === actionableTasks.length ? "Destiny will use completed and verified evidence to shape your next weekly loop." : "Start with research and strategy, then move into content, distribution, and measurement."}</p></div><div className="weekly-progress-ring"><strong>{actionableTasks.length ? Math.round((done / actionableTasks.length) * 100) : 0}%</strong><span>done</span></div><Link className="text-button" href="/results">Review results</Link></section>
    <div className="coach-category-stack">{groups.map((group, index) => <section className="coach-task-category" id={group.id} key={group.id}><div className="coach-category-heading"><span>{index + 1}</span><div><h2>{group.label}</h2><p>{group.description}</p></div><strong>{group.tasks.filter((task) => task.status === "complete").length} / {group.tasks.length}</strong></div><WeeklyTaskList tasks={group.tasks} /></section>)}</div>
  </WorkspaceShell>;
}
