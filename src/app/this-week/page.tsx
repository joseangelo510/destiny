import Link from "next/link";
import { redirect } from "next/navigation";
import { WeeklyTaskList } from "@/components/weekly-task-list";
import { WorkspaceEmpty } from "@/components/workspace-empty";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getCoachTaskWindow } from "@/lib/product/coach-experience";
import { getWorkspaceContext } from "@/lib/workspace-context";

export default async function ThisWeekPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const params = await searchParams;
  const context = await getWorkspaceContext();
  if (!context.website) redirect("/onboarding");
  if (!context.audit || context.audit.status !== "complete") {
    return <WorkspaceShell active="/this-week" eyebrow={context.website.normalized_domain} title="This week" description="Destiny turns your audit into one clear, guided checklist."><WorkspaceEmpty title="Your audit is still being prepared" description="Destiny will notify you when the evidence and weekly plan are ready." /></WorkspaceShell>;
  }
  const allTasks = context.quests.filter((task) => task.audit_id === context.audit?.id);
  const coreTasks = getCoachTaskWindow(allTasks, false);
  const showAll = params.all === "1";
  const visibleTasks = getCoachTaskWindow(allTasks, showAll);
  const done = coreTasks.filter((task) => task.status === "complete").length;
  const remainingRecommendations = Math.max(0, allTasks.length - coreTasks.length);
  const businessUnderstanding = {
    businessName: context.website.business_name,
    productsServices: context.website.products_services,
    problemSolved: context.website.problem_solved,
    idealCustomer: context.website.ideal_customer,
    audienceGoals: context.website.audience_challenges_goals,
    differentiation: context.website.differentiation,
  };
  return <WorkspaceShell active="/this-week" eyebrow={`${context.website.normalized_domain} · Week 1`} title="Your three priorities this week" description="Destiny starts with a short, guided checklist. Confirm our understanding, complete the clearest website action, then review the content prepared for you.">
    <section className="weekly-progress-card"><div><span>{done} of {coreTasks.length} core tasks complete</span><strong>{done === coreTasks.length ? "Your core week is complete" : "One clear step at a time"}</strong><p>{done === coreTasks.length ? "Destiny will use completed and verified evidence to shape your next weekly loop." : "Open the first unfinished task. Every step explains what to do, why it matters, and what done looks like."}</p></div><div className="weekly-progress-ring"><strong>{coreTasks.length ? Math.round((done / coreTasks.length) * 100) : 0}%</strong><span>done</span></div><Link className="text-button" href="/results">Review results</Link></section>
    <div className="weekly-list-heading"><div><span className="eyebrow">Your checklist</span><h2>{showAll ? "All recommendations" : "Start with these three"}</h2></div><span>{visibleTasks.length} tasks shown</span></div>
    <WeeklyTaskList businessUnderstanding={businessUnderstanding} tasks={visibleTasks} />
    {remainingRecommendations > 0 && <section className="contextual-recommendations"><div><strong>{remainingRecommendations} additional recommendations are ready</strong><p>These include keyword, distribution, review, and LLM visibility opportunities. They stay available without distracting from this week’s priorities.</p></div><Link className="secondary-button" href={showAll ? "/this-week" : "/this-week?all=1"}>{showAll ? "Show only this week’s three" : `Explore ${remainingRecommendations} additional recommendations`}</Link></section>}
  </WorkspaceShell>;
}
