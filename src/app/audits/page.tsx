import Link from "next/link";
import { FeatureJourneyCallout } from "@/components/feature-journey-callout";
import { WorkspaceEmpty } from "@/components/workspace-empty";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getWorkspaceContext } from "@/lib/workspace-context";

export default async function AuditsPage() {
  const { supabase, website } = await getWorkspaceContext();
  const { data: audits } = website
    ? await supabase.from("audits").select("id,status,progress,provider,created_at,completed_at,failure_message").eq("website_id", website.id).order("created_at", { ascending: false }).limit(25)
    : { data: [] };

  return (
    <WorkspaceShell active="/audits" eyebrow={website?.normalized_domain ?? "Destiny workspace"} title="Website audits" description="Every audit is saved with its source, status, results, and LOGOS-selected next action.">
      <FeatureJourneyCallout milestone="Stronger foundations" description="Audits uncover the route. Fixing the recommended issue completes the effort; subsequent crawl and search data verify the result." />
      {!website ? <WorkspaceEmpty title="Complete onboarding first" description="Add your business and website before Destiny can create an audit." /> : !audits?.length ? <WorkspaceEmpty title="No audits yet" description="Return to the dashboard and start your first website audit." /> : (
        <section className="workspace-card">
          <div className="workspace-card-heading"><strong>Audit history</strong><span>{audits.length} total</span></div>
          <div className="audit-table">
            {audits.map((audit) => (
              <Link className="audit-row" href={`/audits/${audit.id}`} key={audit.id}>
                <span className={`status-orb ${audit.status}`} />
                <span><strong>{new Date(audit.created_at).toLocaleDateString()}</strong><small>{audit.provider === "dataforseo" ? "Live DataForSEO" : "Demo data"}</small></span>
                <span className={`status-chip ${audit.status === "complete" ? "" : "amber"}`}>{audit.status.replaceAll("_", " ")}</span>
                <span className="audit-progress">{audit.progress}%</span>
                <span className="row-arrow">→</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </WorkspaceShell>
  );
}
