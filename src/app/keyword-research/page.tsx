import { KeywordResearchWorkspace } from "@/components/keyword-research-workspace";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";

export default async function KeywordResearchPage() {
  const { website } = await getWorkspaceContext();
  return <WorkspaceShell
    active="/keyword-research"
    eyebrow={website?.normalized_domain ?? "Destiny workspace"}
    title="Keyword research"
    description="Explore a domain or keyword phrase with live demand, intent, difficulty, CPC, ranking, and traffic estimates—then bring the best opportunities into your coached strategy."
  >
    <KeywordResearchWorkspace initialQuery={website?.normalized_domain ?? ""} />
  </WorkspaceShell>;
}
