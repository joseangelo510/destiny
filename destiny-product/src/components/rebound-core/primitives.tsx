import Link from "next/link";
import type { ReactNode } from "react";
import type { CoreMove, Evidence, LoadState } from "@/lib/rebound-core/contracts";
import styles from "./rebound-core-shell.module.css";

export function StateChip({ state, label }: { state: "idea" | "draft" | "approved" | "scheduled" | "published" | "verified_live"; label?: string }) {
  const defaultLabel = ({ idea: "Idea", draft: "Draft", approved: "Approved", scheduled: "Scheduled", published: "Published", verified_live: "Verified live" } as const)[state];
  return <span className={`${styles.chip} ${styles[`chip_${state}`]}`}><i />{label ?? defaultLabel}</span>;
}

export function EvidenceChip({ evidence, fallback }: { evidence?: Evidence; fallback?: string }) {
  const kind = evidence?.kind ?? "reported";
  return <span className={`${styles.evidence} ${styles[`evidence_${kind}`]}`}>{evidence?.detail ?? fallback ?? "Evidence pending"}</span>;
}

export function MoveChip({ href, label, tone = "default" }: { href: string; label: string; tone?: "hot" | "default" | "quiet" }) {
  return <Link className={`${styles.move} ${styles[`move_${tone}`]}`} href={href}>{label}</Link>;
}

export function Panel({ children, className = "", labelledBy }: { children: ReactNode; className?: string; labelledBy?: string }) {
  return <section aria-labelledby={labelledBy} className={`${styles.panel} ${className}`}>{children}</section>;
}

export function PanelHeader({ title, subtitle, href, action = "Open" }: { title: string; subtitle?: string; href?: string; action?: string }) {
  const id = `panel-${title.toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, "-")}`;
  return <header className={styles.panelHeader}><h2 id={id}>{title}</h2>{subtitle ? <span>{subtitle}</span> : null}{href ? <Link href={href}>{action}</Link> : null}</header>;
}

export function NeedsYouBar({ title, detail, move }: { title: string; detail: string; move?: { href: string; label: string }; }) {
  return <section className={`${styles.needsYou} ${move ? "" : styles.needsYouCalm}`}><span>NEEDS YOU</span><div><strong>{title}</strong><small>{detail}</small></div>{move ? <MoveChip href={move.href} label={move.label} tone="hot" /> : null}</section>;
}

export function StatusStrip({ items }: { items: Array<{ label: string; value: string; detail: string; state?: LoadState }> }) {
  return <section aria-label="Page status" className={styles.statusStrip}>{items.map((item) => <div key={item.label} data-state={item.state ?? "ready"}><span>{item.label}</span><strong>{item.value}</strong><small>{item.detail}</small></div>)}</section>;
}

export function SessionPill({ move, count }: { move: CoreMove | null; count: number }) {
  if (!move) return <div className={`${styles.sessionPill} ${styles.sessionPillCalm}`}><small>Today&apos;s session</small><strong>Nothing needs you right now</strong><span>Rebound SEO is watching for the next move.</span></div>;
  return <Link className={styles.sessionPill} href={move.href}><small>Today&apos;s session</small><strong>{move.title}</strong><span>Move 1 of {Math.min(3, count)} · open</span></Link>;
}

export function Toast({ message }: { message: string | null }) {
  return message ? <div aria-live="polite" className={styles.toast} role="status">{message}</div> : null;
}
