import { redirect } from "next/navigation";
import { HomeDashboard } from "@/components/rebound-core/home-dashboard";
import { loadReboundHome } from "@/lib/rebound-core/load-home";

export const dynamic = "force-dynamic";

export default async function ReboundHomePage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const params = await searchParams;
  const view = await loadReboundHome();
  if (!view) redirect("/onboarding");
  return <HomeDashboard view={view} dashboardOpen={params.view === "dashboard"} />;
}
