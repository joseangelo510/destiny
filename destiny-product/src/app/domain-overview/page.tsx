import { DomainOverviewWorkspace } from "@/components/domain-overview-workspace";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";
export default async function DomainOverviewPage() {
  const { website } = await getWorkspaceContext();
  return <WorkspaceShell active="/domain-overview" eyebrow="Research & discovery" title="Domain Overview" description="The whole picture. Look up any website’s search visibility, traffic, rankings and backlinks.">
    <DomainOverviewWorkspace initialTarget={website?.normalized_domain ?? ""} websiteId={website?.id ?? ""} />
  </WorkspaceShell>;
}
