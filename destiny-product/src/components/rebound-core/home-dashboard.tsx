import Link from "next/link";
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

export function HomeDashboard({ view }: { view: ReboundHomeView }) {
  const searchConnected = view.searchConsole.state === "ready" || view.searchConsole.state === "empty";
  return <ReboundCoreShell active="/app/home" queue={view.queue} searchConnected={searchConnected} websiteId={view.websiteId} websiteLabel={view.websiteLabel} websites={view.websites}><div className={styles.dashboard}><header className={styles.greeting}><h2>{greeting(view.firstName, view.timeZone)}</h2><p>Current evidence for <b>{view.websiteLabel}</b> · missing sources stay visibly empty instead of becoming estimates.</p><Link href="/integrations"><i />{searchConnected ? "Search Console connected" : "Connect Search Console"}</Link></header><SessionQueue result={view.queue} websiteId={view.websiteId} /><HomePerformance analytics={view.analytics} searchConsole={view.searchConsole} /><HomeKeywords result={view.keywords} /><HomeCompetitors result={view.competitors} websiteId={view.websiteId} /><HomeCalendar result={view.calendar} /></div></ReboundCoreShell>;
}
