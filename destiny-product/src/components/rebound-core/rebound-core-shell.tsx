import type { ReactNode } from "react";
import type { CoreQueue, PanelResult, ReboundWebsite } from "@/lib/rebound-core/contracts";
import { CORE_NAVIGATION } from "@/lib/rebound-core/routes";
import { PreviewStrip } from "./preview-strip";
import { WorkspaceNotifications } from "../workspace-notifications";
import { ProductNavigation } from "../product-navigation";
import styles from "./rebound-core-shell.module.css";

const PAGE_SUBTITLES: Record<string, string> = {
  "/app/home": "your comeback, at a glance",
  "/app/content": "every piece, by its true state",
  "/app/calendar": "what happens when",
  "/app/distribution": "every useful next touchpoint",
  "/app/progress": "the full check-in, split by owner",
};

export function ReboundCoreShell({ active, calendarActions = false, coach = false, children, distributionActions = false, draftActions = false, progressActions = false, websiteId, websites, title, subtitle }: { active: string; calendarActions?: boolean; coach?: boolean; children: ReactNode; distributionActions?: boolean; draftActions?: boolean; progressActions?: boolean; queue: PanelResult<CoreQueue>; websiteId: string; websiteLabel: string; websites: ReboundWebsite[]; searchConnected: boolean; title?: string; subtitle?: string }) {
  const current = CORE_NAVIGATION.find((item) => item.href === active);
  return <main className={styles.stage} data-rebound-core="v1" data-approved-shell="preservation" data-coach={coach || undefined}>
    <div className={styles.canvas}>
      <ProductNavigation active={active === "/app/home" && !coach ? "/app/home?view=dashboard" : active} websiteId={websiteId} websites={websites} />
      <section className={styles.main}>
        <header className={styles.topbar}><div><h1>{title ?? current?.label ?? "Rebound SEO"}</h1><span>{subtitle ?? PAGE_SUBTITLES[active] ?? "read-only workspace"}</span></div><WorkspaceNotifications websiteId={websiteId} /></header>
        {!coach && <PreviewStrip calendarActions={calendarActions} distributionActions={distributionActions} draftActions={draftActions} progressActions={progressActions} />}
        {children}
      </section>
    </div>
  </main>;
}
