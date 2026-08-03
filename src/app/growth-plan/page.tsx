import { FeatureJourneyCallout } from "@/components/feature-journey-callout";
import { WorkspaceEmpty } from "@/components/workspace-empty";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getWorkspaceContext, providerResultFromMetrics, record } from "@/lib/workspace-context";
import Link from "next/link";

const months = [
  { month: "Month 1", goal: "Fix the foundations", weeks: ["Resolve critical technical issues", "Confirm indexing and canonicals", "Repair titles and internal links", "Validate measurement"] },
  { month: "Month 2", goal: "Build search coverage", weeks: ["Prioritize keyword opportunities", "Publish a core service page", "Publish a local or use-case page", "Strengthen internal links"] },
  { month: "Month 3", goal: "Create authority", weeks: ["Publish a decision guide", "Add proof and expert experience", "Earn relevant citations", "Refresh the strongest page"] },
];

export default async function GrowthPlanPage() {
  const context = await getWorkspaceContext();
  const providerResult = providerResultFromMetrics(context.metrics);
  const raw = record(context.metrics?.raw_provider_payload);
  const growthStage = typeof raw.growthStage === "string" ? raw.growthStage.replaceAll("_", " ") : "awaiting audit";
  const latestQuest = context.quests.find((quest) => quest.audit_id === context.audit?.id) ?? context.quests[0];

  return (
    <WorkspaceShell active="/growth-plan" eyebrow={context.website?.normalized_domain ?? "Destiny workspace"} title="Three-month growth plan" description="Twelve weekly goals turn the audit into a focused starting sequence your team can actually follow.">
      <FeatureJourneyCallout milestone="Your first 12-week route" description="The three-month plan organizes the work. Your journey shows which steps are complete and which results Destiny has verified." />
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
          <section className="workspace-card plan-extension-gate">
            <div><span className="eyebrow">Continue your momentum</span><h2>Unlock another three-month plan</h2><p>Your starter plan ends after this 12-week cycle. Upgrade to the Growth tier when you are ready for a new strategy built from the results and evidence Destiny has collected.</p></div>
            <Link className="primary-button" href="/#pricing">View upgrade tier</Link>
          </section>
        </>
      )}
    </WorkspaceShell>
  );
}
