import { redirect } from "next/navigation";
import { CalendarDashboard } from "@/components/rebound-core/core-pages";
import { loadReboundCalendar } from "@/lib/rebound-core/load-core-pages";

export const dynamic = "force-dynamic";

export default async function ReboundCalendarPage({ searchParams }: { searchParams: Promise<{ keyword?: string }> }) {
  const view = await loadReboundCalendar();
  if (!view) redirect("/onboarding");
  const { keyword } = await searchParams;
  return <CalendarDashboard view={view} selectedKeyword={keyword} />;
}
