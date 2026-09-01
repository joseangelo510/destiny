import { redirect } from "next/navigation";
import { ContentDashboard } from "@/components/rebound-core/core-pages";
import { loadReboundContent } from "@/lib/rebound-core/load-core-pages";

export const dynamic = "force-dynamic";

export default async function ReboundContentPage() {
  const view = await loadReboundContent();
  if (!view) redirect("/onboarding");
  return <ContentDashboard view={view} />;
}
