import { BacklinkAnalyticsWorkspace } from "@/components/backlink-analytics-workspace";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";

export default async function BacklinksPage() {
  const { website } = await getWorkspaceContext();
  return <WorkspaceShell
    active="/backlinks"
    eyebrow={website?.normalized_domain ?? "Destiny workspace"}
    title="Backlink analytics"
    description="Investigate referring domains, individual backlinks, link quality, anchors, attributes, and broken-link opportunities with live provider data."
  >
    <BacklinkAnalyticsWorkspace initialTarget={website?.normalized_domain ?? ""} />
  </WorkspaceShell>;
}
