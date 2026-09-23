import { BacklinkAnalyticsWorkspace } from "@/components/backlink-analytics-workspace";
import { FeatureJourneyCallout } from "@/components/feature-journey-callout";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getWorkspaceContext } from "@/lib/workspace-context";
import { loadBillingAccount } from "@/lib/billing/account";

export const dynamic = "force-dynamic";

export default async function BacklinksPage() {
  const { website, userId } = await getWorkspaceContext();
  const billing = await loadBillingAccount(userId);
  const domainReportAllowance = billing.available && billing.access.limits
    ? { used: billing.used.domainReports ?? 0, limit: billing.access.limits.domainReports }
    : undefined;
  return <WorkspaceShell
    active="/backlinks"
    eyebrow={website?.normalized_domain ?? "Rebound SEO workspace"}
    title="Backlink analytics"
    description="Investigate referring domains, individual backlinks, link quality, anchors, attributes, and broken-link opportunities with live provider data."
  >
    <FeatureJourneyCallout actionHref="#backlink-analytics-workspace" actionLabel="Analyze your backlink profile" milestone="Build visibility" description="Use the live profile to identify one link opportunity worth investigating." doneLooksLike="A follow-up action is chosen or discarded with a reason." evidence="Source-labeled provider data, never an inferred authority score." />
    <BacklinkAnalyticsWorkspace initialTarget={website?.normalized_domain ?? ""} domainReportAllowance={domainReportAllowance} />
  </WorkspaceShell>;
}
