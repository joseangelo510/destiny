"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FEATURE_NAVIGATION } from "@/lib/product/coach-experience";
import { siteScopedHref } from "@/lib/workspace-selection";
import styles from "./product-navigation.module.css";

type Website = { id: string; business_name: string | null; normalized_domain: string };
const primary = [
  { label: "Home dashboard", href: "/app/home?view=dashboard", icon: "chart" },
  { label: "Coach", href: "/app/home", icon: "file" },
  { label: "Content", href: "/app/content", icon: "file" },
  { label: "Calendar", href: "/app/calendar", icon: "calendar" },
  { label: "Distribution", href: "/app/distribution", icon: "send" },
  { label: "Progress", href: "/app/progress", icon: "chart" },
];
const groups = [
  { label: "Competitor research", paths: ["/domain-overview", "/backlinks"] },
  { label: "Keywords", paths: ["/keyword-research", "/keywords", "/rank-tracker"] },
  { label: "Content creation", paths: ["/content", "/interviews", "/content/repurpose", "/content/infographics"] },
  { label: "Website optimization", paths: ["/audits", "/internal-links"] },
  { label: "Publishing & distribution", paths: ["/content#publishing-plan", "/distribution", "/reviews"] },
  { label: "Analytics & reporting", paths: ["/analytics", "/llm-visibility"] },
  { label: "Planning", paths: ["/results", "/roadmap", "/this-week"] },
];
const tool = (path: string) => ({ ...FEATURE_NAVIGATION.find(item => item.href === path)!, ...(path === "/distribution" ? { label: "Distribution tools" } : {}) });
const utilities = [{ label: "Account", href: "/account" }, { label: "Connections", href: "/integrations" }];
const name = (site: Website) => site.business_name?.trim() || site.normalized_domain;

export function ProductNavigation({ active, websiteId, websites }: { active: string; websiteId: string | null; websites: Website[] }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const current = websites.find(site => site.id === websiteId);
  const href = (path: string) => siteScopedHref(path, websiteId);
  useEffect(() => {
    if (!open) return;
    const first = panel.current?.querySelector<HTMLElement>("a,button,summary");
    first?.focus();
    function keyboard(event: KeyboardEvent) {
      if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
      if (event.key !== "Tab") return;
      const controls = Array.from(panel.current?.querySelectorAll<HTMLElement>("a,button,summary") ?? []).filter(node => node.getClientRects().length > 0);
      const firstControl = controls[0], lastControl = controls.at(-1);
      if (event.shiftKey && document.activeElement === firstControl) { event.preventDefault(); lastControl?.focus(); }
      else if (!event.shiftKey && document.activeElement === lastControl) { event.preventDefault(); firstControl?.focus(); }
    }
    document.addEventListener("keydown", keyboard);
    return () => document.removeEventListener("keydown", keyboard);
  }, [open]);
  function itemLink(item: { label: string; href: string; icon?: string }) {
    const contents = <><span aria-hidden="true" className={`${styles.icon} ${styles[item.icon ?? "file"]}`} /><span>{item.label}</span></>;
    const props = { className: item.href === active ? styles.active : undefined, "aria-current": item.href === active ? "page" as const : undefined, onClick: () => setOpen(false) };
    return item.href.includes("#") ? <a {...props} data-document-navigation="true" href={href(item.href)} key={item.href}>{contents}</a> : <Link {...props} href={href(item.href)} key={item.href}>{contents}</Link>;
  }
  return <div className={styles.frame} data-approved-navigation="preservation">
    <div className={styles.mobilebar}><button ref={trigger} aria-expanded={open} aria-label="Open navigation" onClick={() => setOpen(true)}><span className={`${styles.icon} ${styles.menu}`} /></button><Link className={styles.wordmark} href={href("/app/home")}>Rebound <em>SEO.</em></Link></div>
    {open && <button className={styles.scrim} aria-label="Close navigation backdrop" onClick={() => { setOpen(false); trigger.current?.focus(); }} />}
    <aside className={`${styles.sidebar} ${open ? styles.open : ""}`} ref={panel} aria-label="Workspace navigation">
      <button className={styles.close} aria-label="Close navigation" onClick={() => { setOpen(false); trigger.current?.focus(); }}>Close</button>
      <Link className={styles.wordmark} href={href("/app/home")} aria-label="Rebound SEO workspace home">Rebound <em>SEO.</em></Link>
      {websites.length > 0 ? <details className={styles.site}><summary aria-label={current ? `Current website: ${name(current)}. Choose another website.` : "Choose a website"}>{current ? name(current) : "Choose a website"}<span className={`${styles.icon} ${styles.caret}`} aria-hidden="true" /></summary><div className={styles.siteMenu}>{websites.map(site => <a key={site.id} data-site-switch={site.id} href={siteScopedHref(active,site.id)} aria-current={site.id === current?.id ? "true" : undefined}>{name(site)}<small>{site.normalized_domain}</small></a>)}<Link href="/onboarding?new=1">+ Add another website</Link></div></details> : <Link className={styles.add} href="/onboarding?new=1">Add your first website</Link>}
      <nav aria-label="Main navigation">{primary.map(itemLink)}</nav>
      <p className={styles.divider}>All tools</p>
      <nav aria-label="All tools" className={styles.tools}>{groups.map(group => <details key={`${active}:${group.label}`} data-tool-group={group.label} className={styles.group} open={group.paths.includes(active)}>
        <summary>{group.label}<span className={`${styles.icon} ${styles.caret}`} aria-hidden="true" /></summary>
        <div className={styles.groupLinks}>{group.paths.map(path => itemLink(tool(path)))}</div>
      </details>)}</nav>
      <nav aria-label="Account and connections" className={styles.utilities}>{utilities.map(itemLink)}</nav>
      <form className={styles.signout} action="/auth/signout" method="post"><button type="submit">Sign out</button></form>
    </aside>
  </div>;
}
