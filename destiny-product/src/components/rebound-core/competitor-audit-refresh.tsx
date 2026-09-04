"use client";

import { useState } from "react";
import styles from "./home-dashboard.module.css";

export function CompetitorAuditRefresh({ websiteId }: { websiteId: string }) {
  const [state, setState] = useState<"idle" | "running" | "error">("idle");

  async function run() {
    setState("running");
    try {
      const response = await fetch("/api/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId }),
      });
      const body = await response.json() as { auditId?: string; error?: string };
      if (!response.ok || !body.auditId) throw new Error(body.error || "Audit could not start.");
      window.location.assign(`/audits/${encodeURIComponent(body.auditId)}?site=${encodeURIComponent(websiteId)}`);
    } catch {
      setState("error");
    }
  }

  return <div className={styles.auditRefresh}><button disabled={state === "running"} onClick={() => void run()} type="button">{state === "running" ? "Starting audit…" : "Run a fresh audit"}</button>{state === "error" ? <span role="alert">The audit could not start. Try again.</span> : null}</div>;
}
