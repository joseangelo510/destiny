import { WorkspaceEmpty } from "@/components/workspace-empty";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getWorkspaceContext, providerResultFromMetrics, record } from "@/lib/workspace-context";

const months = [
  { month: "Month 1", goal: "Fix the foundations", weeks: ["Resolve critical technical issues", "Confirm indexing and canonicals", "Repair titles and internal links", "Validate measurement"] },
  { month: "Month 2", goal: "Build search coverage", weeks: ["Prioritize keyword opportunities", "Publish a core service page", "Publish a local or use-case page", "Strengthen internal links"] },
  { month: "Month 3", goal: "Create authority", weeks: ["Publish a decision guide", "Add proof and expert experience", "Earn relevant citations", "Refresh the strongest page"] },
  { month: "Month 4", goal: "Distribute expertise", weeks: ["Find a Reddit discussion", "Answer a Quora question", "Repurpose a guide for video", "Measure referral traffic"] },
  { month: "Month 5", goal: "Improve conversion", weeks: ["Review landing-page behavior", "Improve calls to action", "Add trust and review proof", "Test one conversion change"] },
  { month: "Month 6", goal: "Compound what works", weeks: ["Identify winning queries", "Expand the best topic cluster", "Refresh slipping content", "Set the next quarterly plan"] },
];

export default async function GrowthPlanPage() {
  const context = await getWorkspaceContext();
  const providerResult = providerResultFromMetrics(context.metrics);
  const raw = record(context.metrics?.raw_provider_payload);
  const growthStage = typeof raw.growthStage === "string" ? raw.growthStage.replaceAll("_", " ") : "awaiting audit";
  const latestQuest = context.quests.find((quest) => quest.audit_id === context.audit?.id) ?? context.quests[0];

  return (
    <WorkspaceShell active="/growth-plan" eyebrow={context.website?.normalized_domain ?? "Destiny workspace"} title="Six-month growth plan" description="Monthly outcomes and weekly goals turn the audit into a sequence your team can actually follow.">
      {!context.audit ? <WorkspaceEmpty title="Your plan begins with an audit" description="Complete onboarding and run an audit so LOGOS can select the correct starting stage." /> : (
        <>
          <section className="workspace-summary-strip"><span>Current stage</span><strong>{growthStage}</strong><span>Data source</span><strong>{String(providerResult.sourceLabel ?? context.audit.provider)}</strong><span>First quest</span><strong>{latestQuest?.title ?? "Preparing"}</strong></section>
          <section className="month-grid">
            {months.map((item, monthIndex) => (
              <article className={monthIndex === 0 ? "month-card current" : "month-card"} key={item.month}>
                <div><span>{item.month}</span>{monthIndex === 0 && <b>Current</b>}</div>
                <h2>{item.goal}</h2>
                <ol>{item.weeks.map((week, index) => <li key={week}><span>{index + 1}</span>{index === 0 && monthIndex === 0 && latestQuest ? latestQuest.title : week}</li>)}</ol>
              </article>
            ))}
          </section>
        </>
      )}
    </WorkspaceShell>
  );
}
