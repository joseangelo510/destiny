"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { FEATURE_NAVIGATION } from "@/lib/product/coach-experience";
import type { CoreMove, ReboundHomeView } from "@/lib/rebound-core/contracts";
import { CORE_NAVIGATION } from "@/lib/rebound-core/routes";
import { siteScopedHref } from "@/lib/workspace-selection";
import styles from "./coach-home.module.css";

function DoneDefinition({ move }: { move: CoreMove }) {
  return <section className={styles.donebox} aria-label="What done looks like">
    <h2>What done looks like</h2>
    <ul>
      <li><i aria-hidden="true" /><div>{move.state === "draft" ? "Read the draft and decide what needs editing." : "Open the task and follow its recommended steps."}<small>You{move.estimateMinutes !== null ? ` · about ${move.estimateMinutes} min` : ""}</small></div></li>
      <li><i aria-hidden="true" /><div>{move.state === "draft" ? "Approve it when you are happy with the article." : "Save your work in the tool."}<small>{move.state === "draft" ? "You · approval comes before scheduling" : "You · opening a task does not complete it"}</small></div></li>
      <li><i aria-hidden="true" /><div>Check the result in your workspace.<small>Reported work and verified outcomes stay separate</small></div></li>
    </ul>
  </section>;
}

function StatusStrip({ view }: { view: ReboundHomeView }) {
  const search = view.searchConsole;
  const data = search.state === "ready" ? search.data : null;
  const items = view.queue.state === "ready" ? view.queue.data?.items ?? [] : [];
  const drafts = items.filter((item) => item.state === "draft").length;
  return <section className={styles.ticker} aria-label="Current workspace status" tabIndex={0}>
    <span className={data?.impressions !== null && data?.impressions !== undefined ? styles.measured : ""}>
      {data?.impressions !== null && data?.impressions !== undefined
        ? <><b>{data.impressions.toLocaleString("en-US")} impressions</b> Search Console · last 30 days{data.syncedAt ? <time dateTime={data.syncedAt}>Synced {new Date(data.syncedAt).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" })}</time> : " · sync date unavailable"}</>
        : <><b>Search Console</b> {search.state === "not_connected" ? "Not connected" : search.state === "error" ? "Temporarily unavailable" : search.state === "loading" ? "Loading" : "Waiting for data"}</>}
    </span>
    <span><b>{view.queue.state === "ready" ? `${items.length} open move${items.length === 1 ? "" : "s"}` : view.queue.state === "empty" ? "No open moves" : "Queue unavailable"}</b> in this workspace</span>
    {drafts > 0 ? <span><b>{drafts} draft{drafts === 1 ? "" : "s"}</b> awaiting your review</span> : null}
    {view.keywords.state === "ready" && view.keywords.data ? <span><b>{view.keywords.data.tracked} keywords</b> being tracked</span> : null}
  </section>;
}

export function CoachHome({ view, children }: { view: ReboundHomeView; children: ReactNode }) {
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const workspaceButton = useRef<HTMLButtonElement>(null);
  const coachButton = useRef<HTMLButtonElement>(null);
  const items = view.queue.state === "ready" ? view.queue.data?.items ?? [] : [];
  const selected = Math.max(0, items.findIndex((item) => item.id === selectedId));
  const move = items[selected];
  const onDeck = items.filter((item) => item.id !== move?.id).slice(0, 3);
  const href = (path: string) => siteScopedHref(path, view.websiteId);
  function openWorkspace() {
    setWorkspaceOpen(true);
    requestAnimationFrame(() => coachButton.current?.focus());
  }
  function openCoach() {
    setWorkspaceOpen(false);
    requestAnimationFrame(() => workspaceButton.current?.focus());
  }
  if (workspaceOpen) return <><div className={styles.returnBar}><button ref={coachButton} type="button" onClick={openCoach}>← Back to your coach</button></div>{children}</>;
  return <main className={styles.stage} data-coach-home="warmup">
    <div className={styles.canvas}>
      <header className={styles.topbar}>
        <Link className={styles.wordmark} href={href("/app/home")}><i aria-hidden="true" />Rebound SEO</Link>
        <div className={styles.headerEnd}>
          <button ref={workspaceButton} className={styles.quiet} type="button" onClick={openWorkspace}>Open full workspace</button>
          <details className={styles.sitePicker}><summary aria-label={`Current website: ${view.websiteLabel}. Choose another website.`}>{view.websiteLabel}<span aria-hidden="true">⌄</span></summary><nav aria-label="Choose website">{view.websites.map((site) => <a key={site.id} data-site-switch={site.id} href={siteScopedHref("/app/home", site.id)}>{site.business_name || site.normalized_domain}</a>)}<Link href="/onboarding?new=1">+ Add another website</Link></nav></details>
          <Link className={styles.avatar} aria-label="Account" href={href("/account")}>{(view.firstName || view.websiteLabel).slice(0, 2).toLocaleUpperCase("en-US")}</Link>
        </div>
      </header>
      <StatusStrip view={view} />
      <section className={styles.hero} aria-labelledby="coach-title" data-session-queue>
        <p className={styles.kicker}>Your comeback, one clear move at a time.</p>
        <div aria-live="polite" aria-atomic="true" className={styles.focus}>
          <h1 id="coach-title" data-coach-title>{move?.title ?? (view.queue.state === "error" ? "Your next move is temporarily unavailable." : view.queue.state === "loading" ? "Finding your next move…" : view.queue.state === "not_connected" ? "Connect your workspace to find your next move." : "Nothing needs you right now.")}</h1>
          <p className={styles.why}>{move ? <>{move.description} <strong>{move.why}.</strong></> : view.queue.message || "Your existing tools and saved work are ready whenever you need them."}</p>
          {move ? <DoneDefinition move={move} /> : null}
        </div>
        <div className={styles.actions}>
          {move ? <Link className={styles.primary} href={href(move.href)}>{move.state === "draft" ? "Review the draft" : "Open this move"}</Link> : <button className={styles.primary} type="button" onClick={openWorkspace}>Explore your workspace</button>}
          {items.length > 1 ? <button className={styles.quiet} type="button" onClick={() => setSelectedId(items[(selected + 1) % items.length].id)}>See another move</button> : null}
        </div>
      </section>
      {onDeck.length > 0 ? <section className={styles.deck} aria-label="On deck after this"><h2>On deck after this</h2>{onDeck.map((item) => <Link href={href(item.href)} className={styles.deckRow} key={item.id}><div><strong>{item.title}</strong><small>{item.why}</small></div><span className={styles.state}>{item.state === "draft" ? "Draft" : item.state === "reported" ? "You reported" : item.state === "ready" ? "Ready" : "Open"}</span></Link>)}</section> : null}
      <details className={styles.drawer}><summary>Your full system, one tap away <span aria-hidden="true">⌄</span></summary><nav aria-label="Core workspace" className={styles.coreLinks}>{CORE_NAVIGATION.filter((item) => item.href !== "/app/home").map((item) => <Link href={href(item.href)} key={item.href}>{item.label}<span aria-hidden="true">↗</span></Link>)}</nav><nav aria-label="Existing Rebound SEO tools" className={styles.tools}>{FEATURE_NAVIGATION.map((item) => <Link href={href(item.href)} key={item.href}>{item.label}</Link>)}</nav></details>
      <nav className={styles.mobileNav} aria-label="Core mobile navigation">{CORE_NAVIGATION.map((item) => <Link href={href(item.href)} aria-current={item.href === "/app/home" ? "page" : undefined} key={item.href}>{item.label}</Link>)}</nav>
    </div>
  </main>;
}
