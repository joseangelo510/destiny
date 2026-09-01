"use client";

import Link from "next/link";
import { useState } from "react";
import { siteScopedHref } from "@/lib/workspace-selection";
import styles from "./core-pages.module.css";

type DeliveryState = "idle" | "sending" | "accepted" | "failed";

export function ProgressReportActions({ recipient, websiteId }: { recipient: string | null; websiteId: string }) {
  const [state, setState] = useState<DeliveryState>("idle");
  const [error, setError] = useState("");

  async function sendReport() {
    if (!recipient || state === "sending") return;
    setState("sending");
    setError("");
    try {
      const response = await fetch("/api/progress/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId, requestId: crypto.randomUUID() }),
      });
      const payload = await response.json().catch(() => ({})) as { status?: unknown; error?: unknown };
      if (!response.ok || payload.status !== "accepted") throw new Error(typeof payload.error === "string" ? payload.error : "Rebound SEO could not send the progress report.");
      setState("accepted");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Rebound SEO could not send the progress report.");
      setState("failed");
    }
  }

  return <section className={styles.progressReport} data-progress-report="manual">
    <div><span>SHARE THIS CHECK-IN</span><h2>Send the saved progress summary.</h2><p>{recipient ? <>One report goes to <strong>{recipient}</strong>. Rebound SEO resolves this saved address on the server.</> : <>Add a report email in Account before sending.</>}</p></div>
    <div className={styles.progressReportControls}>
      <button aria-label={recipient ? `Send progress report to ${recipient}` : "Report email unavailable"} disabled={!recipient || state === "sending"} onClick={sendReport} type="button">{state === "sending" ? "Sending…" : "Send progress report"}</button>
      <Link href={siteScopedHref("/account", websiteId)}>Change report email</Link>
      {state === "accepted" ? <span className={styles.progressReportStatus} role="status">Accepted for delivery.</span> : null}
      {state === "failed" ? <span className={styles.progressReportError} role="alert">{error}</span> : null}
    </div>
  </section>;
}
