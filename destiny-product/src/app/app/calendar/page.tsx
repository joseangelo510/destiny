import { redirect } from "next/navigation";
import { CalendarDashboard } from "@/components/rebound-core/core-pages";
import { loadReboundCalendar } from "@/lib/rebound-core/load-core-pages";

export const dynamic = "force-dynamic";

export default async function ReboundCalendarPage() {
  const view = await loadReboundCalendar();
  if (!view) redirect("/onboarding");
  return <CalendarDashboard view={view} />;
}
