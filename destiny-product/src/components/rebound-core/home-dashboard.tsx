import Link from "next/link";
import { CoachHome } from "./coach-home";
import type { ReboundHomeView } from "@/lib/rebound-core/contracts";
import { HomeCalendar } from "./home-calendar";
import { HomeCompetitors } from "./home-competitors";
import { HomeKeywords } from "./home-keywords";
import { HomePerformance } from "./home-performance";
import { ReboundCoreShell } from "./rebound-core-shell";
import { SessionQueue } from "./session-queue";
import styles from "./home-dashboard.module.css";

function greeting(firstName: string | null, timeZone: string) {
  let today: string;
  try {
    today = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long", month: "long", day: "numeric" }).format(new Date());
  } catch {
    today = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" }).format(new Date());
  }
  return `${today}. ${firstName ? `${firstName}, here is` : "Here is"} the clearest next move.`;
}

export function HomeWorkspace({ view }: { view: ReboundHomeView }) {
  const searchConnected = view.searchConsole.state === "ready" || view.searchConsole.state === "empty";
  return <ReboundCoreShell active="/app/home" queue={view.queue} searchConnected={searchConnected} websiteId={view.websiteId} websiteLabel={view.websiteLabel} websites={view.websites}><div className={styles.dashboard}><header className={styles.greeting}><h2>{greeting(view.firstName, view.timeZone)}</h2><p>Your progress for <b>{view.websiteLabel}</b>. Connect your data to see what your work is earning.</p><Link href="/integrations"><i />{searchConnected ? "Search Console connected" : "Connect Search Console"}</Link></header><SessionQueue result={view.queue} websiteId={view.websiteId} /><HomePerformance analytics={view.analytics} searchConsole={view.searchConsole} /><HomeKeywords result={view.keywords} /><HomeCompetitors result={view.competitors} websiteId={view.websiteId} /><HomeCalendar result={view.calendar} /></div></ReboundCoreShell>;
}

export function HomeDashboard({ view, dashboardOpen = false }: { view: ReboundHomeView; dashboardOpen?: boolean }) {
  return <CoachHome key={`${view.websiteId}:${dashboardOpen}`} view={view} dashboardOpen={dashboardOpen}><HomeWorkspace view={view} /></CoachHome>;
}
