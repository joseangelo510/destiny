import { redirect } from "next/navigation";
import { ProgressDashboard } from "@/components/rebound-core/core-pages";
import { loadReboundProgress } from "@/lib/rebound-core/load-core-pages";

export const dynamic = "force-dynamic";

export default async function ReboundProgressPage() {
  const view = await loadReboundProgress();
  if (!view) redirect("/onboarding");
  return <ProgressDashboard view={view} />;
}
