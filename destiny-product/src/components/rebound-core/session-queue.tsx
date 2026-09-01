"use client";

import Link from "next/link";
import { useState } from "react";
import type { CoreQueue, PanelResult } from "@/lib/rebound-core/contracts";
import { siteScopedHref } from "@/lib/workspace-selection";
import shellStyles from "./rebound-core-shell.module.css";
import styles from "./home-dashboard.module.css";

export function SessionQueue({ result, websiteId }: { result: PanelResult<CoreQueue>; websiteId: string }) {
  const [current, setCurrent] = useState(0);
  if (result.state !== "ready" || !result.data) {
    return <section className={`${styles.work} ${styles.workCalm}`}><div className={styles.coach}><span>Today&apos;s session</span><h2>{result.state === "error" ? "The queue needs another try." : "Nothing needs you right now."}</h2><p>{result.message}</p></div><div className={styles.queueEmpty}>Your current tools remain available from the sidebar.</div></section>;
  }
  const queue = result.data;
  const session = queue.sessionMoves;
  const move = session[Math.min(current, Math.max(0, session.length - 1))];
  const finished = current >= session.length;
  return <section className={styles.work} data-session-queue>
    <div className={styles.coach}>
      <div className={styles.coachHeader}><span>Today&apos;s session · {session.length} move{session.length === 1 ? "" : "s"}</span><div>{session.map((item, index) => <i className={index < current ? styles.done : index === current ? styles.now : ""} key={item.id} />)}</div></div>
      {finished ? <div className={styles.coachBody}><h2>Session preview complete.</h2><p>No data changed. Reopen any move from the ranked queue below.</p><button className={styles.skip} onClick={() => setCurrent(0)} type="button">Replay session</button></div> : <div className={styles.coachBody}><h2 data-session-title>{move.title}</h2><p>{move.description}</p><div className={styles.doneDefinition}><b>Why now:</b> {move.why}. Opening the tool does not mark this complete or verified.</div><div className={styles.coachActions}><Link className={shellStyles.primaryAction} href={siteScopedHref(move.href, websiteId)}>Open this move</Link><button className={styles.skip} onClick={() => setCurrent((value) => value + 1)} type="button">Next move</button></div></div>}
    </div>
    <div className={styles.queue}>
      <div className={styles.queueHeading}><span>What needs you, in order</span><small>Ranked from current workspace tasks</small></div>
      {queue.items.map((item, index) => <div className={`${styles.queueRow} ${index < session.length ? styles.sessionRow : ""} ${index === current && !finished ? styles.currentRow : ""}`} data-queue-item={item.id} key={item.id}><span className={styles.priority}>{index + 1}</span><div><strong>{item.title}</strong><p><span>{item.why}</span><em>{item.state}</em></p></div><Link href={siteScopedHref(item.href, websiteId)}>Go</Link></div>)}
      <p className={styles.queueFoot}>The session is the first {session.length} item{session.length === 1 ? "" : "s"} from this same list, so move 1 and queue item 1 cannot drift apart.</p>
    </div>
  </section>;
}
