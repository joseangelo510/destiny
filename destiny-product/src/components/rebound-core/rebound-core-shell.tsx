import Link from "next/link";
import type { ReactNode } from "react";
import { FEATURE_NAVIGATION } from "@/lib/product/coach-experience";
import type { CoreQueue, PanelResult } from "@/lib/rebound-core/contracts";
import { CORE_NAVIGATION } from "@/lib/rebound-core/routes";
import { siteScopedHref } from "@/lib/workspace-selection";
import { PreviewStrip } from "./preview-strip";
import { EvidenceChip, SessionPill } from "./primitives";
import styles from "./rebound-core-shell.module.css";

function CoreLink({ item, active, websiteId }: { item: (typeof CORE_NAVIGATION)[number]; active: string; websiteId: string }) {
  if (item.href !== "/app/home") return <span aria-disabled="true" className={styles.futureLink}>{item.label}<small>Next</small></span>;
  return <Link aria-current={item.href === active ? "page" : undefined} className={item.href === active ? styles.activeLink : ""} href={siteScopedHref(item.href, websiteId)}>{item.label}</Link>;
}

export function ReboundCoreShell({ active, children, queue, websiteId, websiteLabel, searchConnected }: { active: string; children: ReactNode; queue: PanelResult<CoreQueue>; websiteId: string; websiteLabel: string; searchConnected: boolean }) {
  const firstMove = queue.state === "ready" ? queue.data?.items[0] ?? null : null;
  const queueCount = queue.state === "ready" ? queue.data?.sessionMoves.length ?? 0 : 0;
  const daily = CORE_NAVIGATION.filter((item) => item.cadence === "every_day");
  const weekly = CORE_NAVIGATION.filter((item) => item.cadence === "every_week");
  return <main className={styles.stage} data-rebound-core="v1">
    <div className={styles.canvas}>
      <aside className={styles.sidebar}>
        <Link aria-label="Rebound SEO current workspace home" className={styles.wordmark} href={siteScopedHref("/app", websiteId)}><i />Rebound SEO</Link>
        <SessionPill count={queueCount} move={firstMove ? { ...firstMove, href: siteScopedHref(firstMove.href, websiteId) } : null} />
        <span className={styles.tier}>EVERY DAY</span><nav aria-label="Every day">{daily.map((item) => <CoreLink active={active} item={item} key={item.href} websiteId={websiteId} />)}</nav>
        <span className={styles.tier}>EVERY WEEK</span><nav aria-label="Every week">{weekly.map((item) => <CoreLink active={active} item={item} key={item.href} websiteId={websiteId} />)}</nav>
        <span className={styles.tier}>TOOLS</span><nav aria-label="Existing Rebound SEO tools" className={styles.tools}>{FEATURE_NAVIGATION.map((item) => <Link href={siteScopedHref(item.href, websiteId)} key={item.href}>{item.label}</Link>)}</nav>
        <div className={styles.account}><span>{websiteLabel.slice(0, 2).toLocaleUpperCase("en-US")}</span><div><strong>{websiteLabel}</strong><Link href={siteScopedHref("/account", websiteId)}>Account</Link></div></div>
      </aside>
      <section className={styles.main}>
        <header className={styles.topbar}><div><h1>Home</h1><span>the dashboard — fixed, as approved</span></div><EvidenceChip fallback={searchConnected ? "Search Console connected" : "Search Console not connected"} /></header>
        <PreviewStrip />
        {children}
        <nav aria-label="Core mobile navigation" className={styles.mobileNav}>{CORE_NAVIGATION.map((item) => item.href === "/app/home" ? <Link aria-current="page" href={siteScopedHref(item.href, websiteId)} key={item.href}><b>◉</b>{item.label}</Link> : <span aria-disabled="true" key={item.href}><b>▪</b>{item.label}</span>)}</nav>
      </section>
    </div>
  </main>;
}
