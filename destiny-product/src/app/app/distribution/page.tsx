import { redirect } from "next/navigation";
import { DistributionDashboard } from "@/components/rebound-core/core-pages";
import { loadReboundDistribution } from "@/lib/rebound-core/load-core-pages";

export const dynamic = "force-dynamic";

export default async function ReboundDistributionPage() {
  const view = await loadReboundDistribution();
  if (!view) redirect("/onboarding");
  return <DistributionDashboard view={view} />;
}
