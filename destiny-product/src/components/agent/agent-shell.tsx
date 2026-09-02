import Link from "next/link";
import type { ReactNode } from "react";
import { FEATURE_NAVIGATION } from "@/lib/product/coach-experience";
import { CORE_NAVIGATION } from "@/lib/rebound-core/routes";
import { siteScopedHref } from "@/lib/workspace-selection";
import styles from "./agent-shell.module.css";

export function AgentShell({
  children,
  website,
}: {
  children: ReactNode;
  website: { id: string; label: string; domain: string };
}) {
  return <main className={styles.stage}>
    <div className={styles.canvas}>
      <aside className={styles.sidebar}>
        <Link className={styles.brand} href={siteScopedHref("/app/home", website.id)}><i />Rebound SEO</Link>
        <div className={styles.site}><span>{website.label.slice(0, 2).toLocaleUpperCase("en-US")}</span><div><small>Current website</small><strong>{website.label}</strong></div></div>
        <span className={styles.tier}>CORE</span>
        <nav aria-label="Rebound core pages">{CORE_NAVIGATION.map((item) => <Link href={siteScopedHref(item.href, website.id)} key={item.href}>{item.label}</Link>)}</nav>
        <Link aria-current="page" className={styles.agentLink} href={siteScopedHref("/app/agent", website.id)}>✦ Ask Rebound</Link>
        <span className={styles.tier}>TOOLS</span>
        <nav aria-label="Existing Rebound SEO tools">{FEATURE_NAVIGATION.map((item) => <Link href={siteScopedHref(item.href, website.id)} key={item.href}>{item.label}</Link>)}</nav>
        <p className={styles.account}>{website.domain}</p>
      </aside>
      <section className={styles.main}>
        <header className={styles.topbar}><div><h1>Ask Rebound</h1><span>your site-aware SEO operating partner</span></div><Link href={siteScopedHref("/app/home", website.id)}>Back to Home</Link></header>
        {children}
        <nav aria-label="Core mobile navigation" className={styles.mobileNav}>{CORE_NAVIGATION.map((item) => <Link href={siteScopedHref(item.href, website.id)} key={item.href}>{item.label}</Link>)}</nav>
      </section>
    </div>
  </main>;
}
