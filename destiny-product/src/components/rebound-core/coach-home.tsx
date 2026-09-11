"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import type { CoreMove, ReboundHomeView } from "@/lib/rebound-core/contracts";
import { siteScopedHref } from "@/lib/workspace-selection";
import { ReboundCoreShell } from "./rebound-core-shell";
import styles from "./coach-home.module.css";

function DoneDefinition({ move }: { move: CoreMove }) {
  return <section className={styles.donebox} aria-label="What done looks like">
    <h2>What done looks like</h2>
    <ul>
      <li><i aria-hidden="true" /><div>{move.state === "draft" ? "Read the draft." : "Open the task and follow its recommended steps."}<small>You{move.estimateMinutes !== null ? ` · about ${move.estimateMinutes} min` : ""}</small></div></li>
      <li><i aria-hidden="true" /><div>{move.state === "draft" ? "Approve or request edits." : "Save your work in the tool."}<small>{move.state === "draft" ? "You · approval comes before scheduling" : "You · opening a task does not complete it"}</small></div></li>
      <li><i aria-hidden="true" /><div>{move.state === "draft" ? "Check publication evidence." : "Check the result in your workspace."}<small>{move.state === "draft" ? "Rebound, when connected" : "Reported work and verified outcomes stay separate"}</small></div></li>
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
    {view.keywords.state === "ready" && view.keywords.data ? <span><b>{view.keywords.data.tracked} keyword{view.keywords.data.tracked === 1 ? "" : "s"}</b> being tracked</span> : null}
  </section>;
}

export function CoachHome({ view, children, dashboardOpen = false }: { view: ReboundHomeView; children: ReactNode; dashboardOpen?: boolean }) {
  const [workspaceOpen, setWorkspaceOpen] = useState(dashboardOpen);
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
  return <ReboundCoreShell active="/app/home" coach queue={view.queue} searchConnected={view.searchConsole.state === "ready" || view.searchConsole.state === "empty"} websiteId={view.websiteId} websiteLabel={view.websiteLabel} websites={view.websites} title="Your coach" subtitle="Your comeback starts with this move.">
    <div className={styles.stage} data-coach-home="warmup" data-coach-design="preserved">
      <div className={styles.workspaceAccess}><button ref={workspaceButton} className={styles.quiet} type="button" onClick={openWorkspace}>Open full workspace</button></div>
      <StatusStrip view={view} />
      <section className={styles.hero} aria-labelledby="coach-title" data-session-queue>
        <p className={styles.kicker}>Today’s move</p>
        <div aria-live="polite" aria-atomic="true" className={styles.focus}>
          <h2 id="coach-title" data-coach-title>{(move?.state === "draft" ? "Review your next article" : move?.title) ?? (view.queue.state === "error" ? "Your next move is temporarily unavailable." : view.queue.state === "loading" ? "Finding your next move…" : view.queue.state === "not_connected" ? "Connect your workspace to find your next move." : "Nothing needs you right now.")}</h2>
          {move?.state === "draft" ? <p className={styles.taskName}>{move.title}</p> : null}
          <p className={styles.meta}>{move ? <>{move.state === "draft" ? "Draft" : move.state === "reported" ? "You reported" : move.state === "ready" ? "Ready" : "Open"}{move.estimateMinutes !== null ? ` · about ${move.estimateMinutes} min` : ""}</> : null}</p>
          <p className={styles.why}>{move ? move.state === "draft" ? "Read it, request changes or approve. Nothing publishes without you." : <>{move.description} <strong>{move.why}.</strong></> : view.queue.message || "Your existing tools and saved work are ready whenever you need them."}</p>
          {move ? <DoneDefinition move={move} /> : null}
        </div>
        <div className={styles.actions}>
          {move ? <Link className={styles.primary} href={href(move.href)}>{move.state === "draft" ? "Review article" : "Open this move"}<span className={styles.arrow} aria-hidden="true" /></Link> : <button className={styles.primary} type="button" onClick={openWorkspace}>Explore your workspace</button>}
          {items.length > 1 ? <button className={styles.quiet} type="button" onClick={() => setSelectedId(items[(selected + 1) % items.length].id)}>See another move</button> : null}
        </div>
      </section>
      {onDeck.length > 0 ? <section className={styles.deck} aria-label="On deck after this"><h2>On deck after this</h2>{onDeck.map((item) => <Link href={href(item.href)} className={styles.deckRow} key={item.id}><div><strong>{item.title}</strong><small>{item.why}</small></div><span className={styles.state}>{item.state === "draft" ? "Draft" : item.state === "reported" ? "You reported" : item.state === "ready" ? "Ready" : "Open"}</span></Link>)}</section> : null}
    </div>
  </ReboundCoreShell>;
}
