import Link from "next/link";
import type { ReactNode } from "react";
import { FEATURE_NAVIGATION, PRIMARY_NAVIGATION } from "../lib/product/coach-experience";
import { siteScopedHref } from "../lib/workspace-selection";
import { WorkspaceNotifications } from "./workspace-notifications";
import styles from "./workspace-shell.module.css";

export type WorkspaceSite = { id: string; business_name: string | null; normalized_domain: string };

function siteLabel(site: WorkspaceSite) { return site.business_name?.trim() || site.normalized_domain; }

function SiteContext({ activeWebsiteId, pathname, websites }: { activeWebsiteId: string | null; pathname: string; websites: WorkspaceSite[] }) {
  const current = websites.find((website) => website.id === activeWebsiteId) ?? websites[0];
  if (!current) return <Link className={styles.singleSiteAdd} href="/onboarding?new=1">Add your first website</Link>;
  const mark = siteLabel(current).slice(0, 2);
  if (websites.length === 1) return <div className={styles.siteContext}>
    <div className={styles.singleSite}><span className={styles.siteMark}>{mark}</span><span className={styles.siteCopy}><small>Current website</small><strong>{siteLabel(current)}</strong></span></div>
    <Link className={styles.singleSiteAdd} href="/onboarding?new=1">+ Add another website</Link>
  </div>;
  return <details className={styles.siteContext}>
    <summary aria-label={`Current website: ${siteLabel(current)}. Choose another website.`}><span className={styles.siteMark}>{mark}</span><span className={styles.siteCopy}><small>Current website</small><strong>{siteLabel(current)}</strong></span></summary>
    <div className={styles.siteMenu}>
      {websites.map((website) => <Link className={`${styles.siteOption} ${website.id === current.id ? styles.siteOptionActive : ""}`} href={siteScopedHref(pathname, website.id)} key={website.id}>{siteLabel(website)}{website.business_name ? <small>{website.normalized_domain}</small> : null}</Link>)}
      <Link className={styles.addSite} href="/onboarding?new=1">+ Add another website</Link>
    </div>
  </details>;
}

export function WorkspaceShellView({ active, eyebrow, title, description, children, websites = [], activeWebsiteId = null }: { active: string; eyebrow: string; title: string; description: string; children: ReactNode; websites?: WorkspaceSite[]; activeWebsiteId?: string | null }) {
  const activeFeature = FEATURE_NAVIGATION.find((item) => item.href === active);
  const href = (path: string) => siteScopedHref(path, activeWebsiteId);
  return <main className="app-shell">
    <aside className="sidebar">
      <Link aria-label="Destiny homepage" className="brand sidebar-brand" href="/"><span className="brand-mark">D</span><span>Destiny</span></Link>
      <SiteContext activeWebsiteId={activeWebsiteId} pathname={active} websites={websites} />
      <nav aria-label="Destiny workspace"><span className="nav-section-label">Your coaching</span>{PRIMARY_NAVIGATION.map((item) => <Link className={`primary-nav-item ${item.href === active ? "active" : ""}`} href={href(item.href)} key={item.label}><span className="nav-dot" />{item.label}</Link>)}</nav>
      <details className="desktop-feature-menu" open={Boolean(activeFeature)}><summary><span>{activeFeature?.label ?? "Tools & reports"}</span><b>{activeFeature ? "Current tool" : `${FEATURE_NAVIGATION.length} available`}</b></summary><div>{FEATURE_NAVIGATION.map((item) => <Link className={item.href === active ? "active" : ""} href={href(item.href)} key={item.label}>{item.label}</Link>)}</div></details>
      <details className="mobile-feature-menu"><summary>Tools & reports</summary><div>{FEATURE_NAVIGATION.map((item) => <Link className={item.href === active ? "active" : ""} href={href(item.href)} key={item.label}>{item.label}</Link>)}<Link className={`mobile-menu-account ${active === "/account" ? "active" : ""}`} href={href("/account")}>Account</Link><form action="/auth/signout" method="post"><button className="mobile-menu-signout" type="submit">Sign out</button></form></div></details>
      <div className="sidebar-account-actions">
        <Link className={`sidebar-account-link ${active === "/account" ? "active" : ""}`} href="/account">Account</Link>
        <form action="/auth/signout" method="post"><button className="sidebar-signout" type="submit">Sign out</button></form>
      </div>
    </aside>
    <section className="dashboard workspace-page" data-active={active}><header className="workspace-header"><div className="workspace-header-copy"><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div><WorkspaceNotifications /></header>{children}</section>
    <nav aria-label="Primary mobile navigation" className="mobile-primary-nav">{PRIMARY_NAVIGATION.map((item) => <Link className={item.href === active ? "active" : ""} href={href(item.href)} key={item.label}>{item.label}</Link>)}</nav>
  </main>;
}
