import Link from "next/link";
import { KeywordResearchWorkspace } from "@/components/keyword-research-workspace";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";

export default async function KeywordResearchPage({ searchParams }: { searchParams?: Promise<{ from?: string; site?: string }> }) {
  const params = searchParams ? await searchParams : {};
  const { website } = await getWorkspaceContext();
  const fromStrategy = params.from === "strategy" && (!params.site || params.site === website?.id);
  return <WorkspaceShell
    active="/keyword-research"
    eyebrow={website?.normalized_domain ?? "Destiny workspace"}
    title={fromStrategy ? "Find more keyword ideas" : "Keyword research"}
    description={fromStrategy
      ? "Explore fresh live demand beyond your current recommendations. Your saved approve and decline decisions remain intact — new results are research only until you choose to act on them."
      : "Explore a domain or keyword phrase with live demand, intent, difficulty, CPC, ranking, and traffic estimates—then bring the best opportunities into your coached strategy."}
  >
    {fromStrategy && <div className="workspace-card keyword-research-return"><p>Done exploring? Your keyword strategy is exactly as you left it.</p><Link className="secondary-button" href="/keywords">Back to keyword strategy</Link></div>}
    <KeywordResearchWorkspace initialQuery={website?.normalized_domain ?? ""} websiteId={website?.id ?? ""} />
  </WorkspaceShell>;
}
