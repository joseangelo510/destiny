import { KeywordResearchWorkspace } from "@/components/keyword-research-workspace";
import { FeatureJourneyCallout } from "@/components/feature-journey-callout";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getWorkspaceContext } from "@/lib/workspace-context";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function KeywordResearchPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const params = await searchParams;
  const { website } = await getWorkspaceContext();
  const fromStrategy = params.from === "strategy";
  return <WorkspaceShell
    active="/keyword-research"
    eyebrow={website?.normalized_domain ?? "Destiny workspace"}
    title={fromStrategy ? "Find more keyword ideas" : "Keyword research"}
    description={fromStrategy ? "Not happy with the first recommendation pool? Research another phrase or domain, compare live demand, and track better alternatives." : "Explore a domain or keyword phrase with live demand, intent, difficulty, CPC, ranking, and traffic estimates—then bring the best opportunities into your coached strategy."}
  >
    {fromStrategy && <section className="workspace-card"><div className="workspace-card-heading"><div><strong>You can keep your current decisions</strong><small>Research alternatives here; the original recommendations stay available when you return.</small></div><Link className="secondary-button" href={`/keywords?site=${website?.id ?? ""}`}>Back to keyword strategy</Link></div></section>}
    <FeatureJourneyCallout actionHref="#keyword-research-workspace" actionLabel="Research one opportunity" milestone="Get ready to be found" description="Use a real search signal to decide what belongs in the coached strategy." doneLooksLike="A keyword is tracked or deliberately moved into Keyword strategy." evidence="Live provider research and a saved tracker or strategy decision." />
    <KeywordResearchWorkspace initialQuery={website?.normalized_domain ?? ""} websiteId={website?.id ?? ""} />
  </WorkspaceShell>;
}
