import Link from "next/link";
import { redirect } from "next/navigation";
import { PlanSelector } from "@/components/plan-selector";
import { WeeklyTaskList } from "@/components/weekly-task-list";
import { WorkspaceEmpty } from "@/components/workspace-empty";
import { WorkspaceShell } from "@/components/workspace-shell";
import { PLAN_TIERS, type PlanTierId } from "@/lib/plans/weekly-plan";
import { getWorkspaceContext } from "@/lib/workspace-context";

const tierNumber: Record<PlanTierId, number> = { beginner: 1, moderate: 2, super_growth: 3 };

export default async function ThisWeekPage({ searchParams }: { searchParams: Promise<{ change?: string }> }) {
  const params = await searchParams;
  const context = await getWorkspaceContext();
  if (!context.website) redirect("/onboarding");
  if (!context.audit || context.audit.status !== "complete") {
    return <WorkspaceShell active="/this-week" eyebrow={context.website.normalized_domain} title="This week" description="Destiny turns your audit into one clear, guided checklist."><WorkspaceEmpty title="Your audit is still being prepared" description="Destiny will notify you when the evidence and weekly plan are ready." /></WorkspaceShell>;
  }
  const selectedTier = context.website.plan_tier as PlanTierId | null;
  const plan = selectedTier ? PLAN_TIERS.find((item) => item.id === selectedTier) : null;
  const tasks = selectedTier ? context.quests.filter((task) => task.audit_id === context.audit?.id && task.min_plan_tier <= tierNumber[selectedTier]) : [];
  const done = tasks.filter((task) => task.status === "complete").length;
  const choosing = !selectedTier || params.change === "1";
  return <WorkspaceShell active="/this-week" eyebrow={`${context.website.normalized_domain} · Week 1`} title={!choosing ? "Your clearest path this week" : "Your audit is ready. Choose your pace."} description={!choosing ? `Complete ${plan?.taskCount ?? tasks.length} guided tasks in about ${plan?.minutes ?? 30} minutes. Start with the expanded task below.` : "Beginner, Moderate, and Super Growth plans use the same evidence with a different weekly workload."}>
    {choosing ? <PlanSelector websiteId={context.website.id} /> : <>
      <section className="weekly-progress-card"><div><span>{done} of {tasks.length} complete</span><strong>{plan?.label} plan</strong><p>{done === tasks.length ? "This week is complete. Destiny will use the evidence to shape your next loop." : "Open the first unfinished task. Every step includes the why, the time, and the exact place to act."}</p></div><div className="weekly-progress-ring"><strong>{tasks.length ? Math.round((done / tasks.length) * 100) : 0}%</strong><span>done</span></div><Link className="text-button" href="/this-week?change=1">Change pace</Link></section>
      <WeeklyTaskList tasks={tasks} />
    </>}
  </WorkspaceShell>;
}
