import Link from "next/link";
import type { ReactNode } from "react";
import { FEATURE_NAVIGATION } from "@/lib/product/coach-experience";
import type { CoreQueue, PanelResult, ReboundWebsite } from "@/lib/rebound-core/contracts";
import { CORE_NAVIGATION } from "@/lib/rebound-core/routes";
import { siteScopedHref } from "@/lib/workspace-selection";
import { PreviewStrip } from "./preview-strip";
import { EvidenceChip, SessionPill } from "./primitives";
import styles from "./rebound-core-shell.module.css";

function CoreLink({ item, active, websiteId }: { item: (typeof CORE_NAVIGATION)[number]; active: string; websiteId: string }) {
  return <Link aria-current={item.href === active ? "page" : undefined} className={item.href === active ? styles.activeLink : ""} href={siteScopedHref(item.href, websiteId)}>{item.label}</Link>;
}

function websiteName(website: ReboundWebsite) {
  return website.business_name?.trim() || website.normalized_domain;
}

function WebsiteSwitcher({ active, className = "", websiteId, websites }: { active: string; className?: string; websiteId: string; websites: ReboundWebsite[] }) {
  const current = websites.find((website) => website.id === websiteId) ?? websites[0];
  if (!current) return null;
  if (websites.length === 1) return <div className={`${styles.siteContext} ${className}`}><span>{websiteName(current).slice(0, 2).toLocaleUpperCase("en-US")}</span><div><small>Current website</small><strong>{websiteName(current)}</strong></div></div>;
  return <details className={`${styles.siteContext} ${className}`}>
    <summary aria-label={`Current website: ${websiteName(current)}. Choose another website.`}><span>{websiteName(current).slice(0, 2).toLocaleUpperCase("en-US")}</span><div><small>Current website</small><strong>{websiteName(current)}</strong></div></summary>
    <div className={styles.siteMenu}>{websites.map((website) => <a data-site-switch={website.id} href={siteScopedHref(active, website.id)} key={website.id}><strong>{websiteName(website)}</strong>{website.business_name ? <small>{website.normalized_domain}</small> : null}</a>)}<Link href="/onboarding?new=1">+ Add another website</Link></div>
  </details>;
}

const PAGE_SUBTITLES: Record<string, string> = {
  "/app/home": "the dashboard — fixed, as approved",
  "/app/content": "every piece, by its true state",
  "/app/calendar": "what happens when",
  "/app/distribution": "every useful next touchpoint",
  "/app/progress": "the full check-in, split by owner",
};

export function ReboundCoreShell({ active, calendarActions = false, children, distributionActions = false, draftActions = false, progressActions = false, queue, websiteId, websiteLabel, websites, searchConnected, title, subtitle }: { active: string; calendarActions?: boolean; children: ReactNode; distributionActions?: boolean; draftActions?: boolean; progressActions?: boolean; queue: PanelResult<CoreQueue>; websiteId: string; websiteLabel: string; websites: ReboundWebsite[]; searchConnected: boolean; title?: string; subtitle?: string }) {
  const firstMove = queue.state === "ready" ? queue.data?.items[0] ?? null : null;
  const queueCount = queue.state === "ready" ? queue.data?.sessionMoves.length ?? 0 : 0;
  const daily = CORE_NAVIGATION.filter((item) => item.cadence === "every_day");
  const weekly = CORE_NAVIGATION.filter((item) => item.cadence === "every_week");
  const current = CORE_NAVIGATION.find((item) => item.href === active);
  return <main className={styles.stage} data-rebound-core="v1">
    <div className={styles.canvas}>
      <aside className={styles.sidebar}>
        <Link aria-label="Rebound SEO current workspace home" className={styles.wordmark} href={siteScopedHref("/app", websiteId)}><i />Rebound SEO</Link>
        <WebsiteSwitcher active={active} websiteId={websiteId} websites={websites} />
        <SessionPill count={queueCount} move={firstMove ? { ...firstMove, href: siteScopedHref(firstMove.href, websiteId) } : null} />
        <span className={styles.tier}>EVERY DAY</span><nav aria-label="Every day">{daily.map((item) => <CoreLink active={active} item={item} key={item.href} websiteId={websiteId} />)}</nav>
        <span className={styles.tier}>EVERY WEEK</span><nav aria-label="Every week">{weekly.map((item) => <CoreLink active={active} item={item} key={item.href} websiteId={websiteId} />)}</nav>
        <span className={styles.tier}>TOOLS</span><nav aria-label="Existing Rebound SEO tools" className={styles.tools}>{FEATURE_NAVIGATION.map((item) => <Link href={siteScopedHref(item.href, websiteId)} key={item.href}>{item.label}</Link>)}</nav>
        <div className={styles.account}><span>{websiteLabel.slice(0, 2).toLocaleUpperCase("en-US")}</span><div><strong>{websiteLabel}</strong><Link href={siteScopedHref("/account", websiteId)}>Account</Link></div></div>
      </aside>
      <section className={styles.main}>
        <header className={styles.topbar}><div><h1>{title ?? current?.label ?? "Rebound SEO"}</h1><span>{subtitle ?? PAGE_SUBTITLES[active] ?? "read-only workspace"}</span></div><WebsiteSwitcher active={active} className={styles.mobileSiteContext} websiteId={websiteId} websites={websites} /><div className={styles.topbarActions}><EvidenceChip fallback={searchConnected ? "Search Console connected" : "Search Console not connected"} /></div></header>
        <PreviewStrip calendarActions={calendarActions} distributionActions={distributionActions} draftActions={draftActions} progressActions={progressActions} />
        {children}
        <nav aria-label="Core mobile navigation" className={styles.mobileNav}>{CORE_NAVIGATION.map((item) => <Link aria-current={item.href === active ? "page" : undefined} href={siteScopedHref(item.href, websiteId)} key={item.href}><b>{item.href === active ? "◉" : "▪"}</b>{item.label}</Link>)}</nav>
      </section>
    </div>
  </main>;
}
