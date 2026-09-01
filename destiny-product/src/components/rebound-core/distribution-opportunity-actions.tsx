"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { DistributionOpportunityAction } from "@/lib/rebound-core/distribution-actions";
import styles from "./core-pages.module.css";

export function DistributionOpportunityActions({ action, reverifyHref, stale }: {
  action: DistributionOpportunityAction | null;
  reverifyHref: string;
  stale: boolean;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timeout.current) clearTimeout(timeout.current);
  }, []);

  if (!action) return <div className={styles.distributionAction}><button aria-label="Saved destination unavailable" disabled type="button">Unavailable</button><small>Saved destination failed the safety check.</small></div>;
  if (stale) return <div className={styles.distributionAction}><Link href={reverifyHref}>Reverify in Distribution</Link><small>opens the existing Distribution tool</small></div>;

  async function copyAndOpen() {
    if (!action) return;
    setNotice(null);
    try {
      await navigator.clipboard.writeText(action.copyText);
      window.open(action.url, "_blank", "noopener,noreferrer");
      setNotice("Context copied.");
      if (timeout.current) clearTimeout(timeout.current);
      timeout.current = setTimeout(() => setNotice(null), 2500);
    } catch {
      setNotice("Copy failed — thread not opened.");
    }
  }

  return <div className={styles.distributionAction}>
    <button aria-label={`Copy saved context and open ${action.platform}`} onClick={copyAndOpen} type="button">Copy context &amp; open {action.platform}</button>
    <small>opens {action.hostname}</small>
    <span aria-live="polite" role="status">{notice}</span>
  </div>;
}
