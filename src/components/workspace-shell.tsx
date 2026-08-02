import Link from "next/link";
import type { ReactNode } from "react";
import { FEATURE_NAVIGATION, PRIMARY_NAVIGATION } from "@/lib/product/coach-experience";
import { WorkspaceNotifications } from "@/components/workspace-notifications";

export function WorkspaceShell({
  active,
  eyebrow,
  title,
  description,
  children,
}: {
  active: string;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Link aria-label="Destiny homepage" className="brand sidebar-brand" href="/"><span className="brand-mark">D</span><span>Destiny</span></Link>
        <nav aria-label="Destiny workspace">
          <span className="nav-section-label">Your coaching</span>
          {PRIMARY_NAVIGATION.map((item) => (
            <Link className={`primary-nav-item ${item.href === active ? "active" : ""}`} href={item.href} key={item.label}><span className="nav-dot" />{item.label}</Link>
          ))}
          <span className="nav-section-label feature-label">Explore features</span>
          {FEATURE_NAVIGATION.map((item) => (
            <Link className={`feature-nav-item ${item.href === active ? "active" : ""}`} href={item.href} key={item.label}><span className="nav-dot" />{item.label}</Link>
          ))}
        </nav>
        <details className="mobile-feature-menu">
          <summary>Explore features</summary>
          <div>{FEATURE_NAVIGATION.map((item) => <Link className={item.href === active ? "active" : ""} href={item.href} key={item.label}>{item.label}</Link>)}</div>
        </details>
        <div className="sidebar-card"><span className="logic-pulse" /><strong>LOGOS rules active</strong><p>Destiny’s next-action rules are compiled by LOGICAFFEINE.</p></div>
        <form action="/auth/signout" method="post"><button className="sidebar-signout" type="submit">Sign out</button></form>
      </aside>
      <section className="dashboard workspace-page">
        <header className="workspace-header">
          <div className="workspace-header-top"><div className="eyebrow">{eyebrow}</div><WorkspaceNotifications /></div>
          <h1>{title}</h1>
          <p>{description}</p>
        </header>
        {children}
      </section>
      <nav aria-label="Primary mobile navigation" className="mobile-primary-nav">
        {PRIMARY_NAVIGATION.map((item) => <Link className={item.href === active ? "active" : ""} href={item.href} key={item.label}>{item.label}</Link>)}
      </nav>
    </main>
  );
}
