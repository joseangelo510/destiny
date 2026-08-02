"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CompassCompanion } from "./compass-companion";
import {
  DEFAULT_CELEBRATION_PREFERENCES,
  playDestinySound,
  readCelebrationPreferences,
  saveCelebrationPreferences,
  type CelebrationPreferences,
} from "../lib/product/celebrations";
import { AUDIT_MOMENTUM_STAGES, auditMomentumJourney } from "../lib/product/momentum-journey";

type AuditStatus = "running" | "complete" | "failed";

export function AuditMomentumProcessing({
  auditId,
  failureMessage = "Destiny could not complete this audit.",
  initialProgress,
  initialStatus,
  onRetry,
  website,
}: {
  auditId?: string | null;
  failureMessage?: string | null;
  initialProgress: number;
  initialStatus: AuditStatus;
  onRetry?: () => void;
  website: string;
}) {
  const [status, setStatus] = useState<AuditStatus>(initialStatus);
  const [progress, setProgress] = useState(initialProgress);
  const [error, setError] = useState(failureMessage ?? "Destiny could not complete this audit.");
  const [celebrationPreferences, setCelebrationPreferences] = useState<CelebrationPreferences>(DEFAULT_CELEBRATION_PREFERENCES);
  const [celebrationsReady, setCelebrationsReady] = useState(false);
  const journey = useMemo(() => auditMomentumJourney(progress, status), [progress, status]);
  const failed = status === "failed";
  const complete = status === "complete";
  const displayWebsite = website.trim() || "your business";

  useEffect(() => {
    const saved = readCelebrationPreferences();
    document.documentElement.dataset.reducedCelebrations = String(saved.reduced);
    const hydrationTimer = window.setTimeout(() => {
      setCelebrationPreferences(saved);
      setCelebrationsReady(true);
    }, 0);
    return () => window.clearTimeout(hydrationTimer);
  }, []);

  useEffect(() => {
    if (status !== "running" || !auditId) return;
    let cancelled = false;
    const poll = async () => {
      const response = await fetch(`/api/audits/${encodeURIComponent(auditId)}`, { cache: "no-store" });
      if (!response.ok || cancelled) return;
      const payload = await response.json() as { audit?: { status?: string; progress?: number; failure_message?: string | null } };
      if (typeof payload.audit?.progress === "number") setProgress(payload.audit.progress);
      if (payload.audit?.status === "complete") {
        setProgress(100);
        setStatus("complete");
        void playDestinySound("verified_result");
        window.setTimeout(() => window.location.reload(), 1100);
      } else if (payload.audit?.status === "failed") {
        setStatus("failed");
        setError(payload.audit.failure_message || "Destiny could not complete this audit.");
      }
    };
    void poll();
    const interval = window.setInterval(() => void poll(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [auditId, status]);

  const toggleSound = () => {
    const next = { ...celebrationPreferences, muted: !celebrationPreferences.muted };
    setCelebrationPreferences(next);
    saveCelebrationPreferences(next);
  };

  return <main className={`processing-shell momentum-processing ${failed ? "failed" : complete ? "complete" : "running"}`}>
    <section className="processing-card momentum-processing-card">
      <header className="processing-header">
        <Link className="brand" href="/"><span className="brand-mark">D</span><span>Destiny</span></Link>
        <button aria-label={celebrationPreferences.muted ? "Turn Destiny sounds on" : "Mute Destiny sounds"} className="onboarding-sound-toggle" disabled={!celebrationsReady} onClick={toggleSound} type="button">{celebrationPreferences.muted ? "Sound off" : "♪ Sound on"}</button>
      </header>
      <div className="momentum-processing-grid">
        <section className="momentum-processing-hero">
          <div className="eyebrow">{failed ? "Research paused" : complete ? "Route ready" : "Live research in progress"}</div>
          <h1>{failed ? "We couldn’t finish this audit." : complete ? "Your first SEO route is ready." : `Your momentum is building for ${displayWebsite}.`}</h1>
          <p>{failed ? error : complete ? "Destiny saved the evidence and built your first coaching plan. Taking you to the results now." : "You finished the onboarding. Destiny is now doing the research, prioritization, and planning that would normally take hours of agency work."}</p>
          <CompassCompanion
            ariaLabel={`Research compass showing ${journey.completedCount} of ${AUDIT_MOMENTUM_STAGES.length} saved stages`}
            completed={journey.completedCount}
            description="It brightens only when a live research checkpoint is saved."
            title={complete ? "Your route is illuminated" : "Your research compass"}
            total={AUDIT_MOMENTUM_STAGES.length}
          />
          <div className="audit-live-progress">
            <div><strong>{journey.percent}% saved</strong><span>{journey.completedCount} of {AUDIT_MOMENTUM_STAGES.length} research stages</span></div>
            <div aria-label={`Audit ${journey.percent}% complete`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={journey.percent} className="audit-live-progress-track" role="progressbar"><span style={{ width: `${journey.percent}%` }} /></div>
            <p aria-live="polite">{journey.statusLine}</p>
          </div>
          {!failed && <div className="founder-encouragement"><span>Small steps. Real evidence.</span><strong>You do not need an SEO team to build search momentum.</strong></div>}
        </section>

        <section className="audit-momentum-route" aria-label="Live audit journey">
          <div className="audit-route-heading"><span>Your first SEO expedition</span><h2>See what Destiny is doing</h2><p>Every completed stop below comes from saved research—not simulated progress.</p></div>
          <ol>
            {journey.stages.map((stage, index) => <li aria-current={stage.state === "active" || stage.state === "failed" ? "step" : undefined} className={stage.state} key={stage.id}>
              <span className="audit-stage-marker">{stage.state === "complete" ? "✓" : stage.state === "failed" ? "!" : index + 1}</span>
              <div><strong>{stage.title}</strong><p>{stage.state === "active" ? stage.activeMessage : stage.description}</p><small>{stage.state === "complete" ? "Research saved" : stage.state === "active" ? "Working now" : stage.state === "failed" ? "Needs attention" : "Up next"}</small></div>
            </li>)}
          </ol>
          <div className="configuration-note"><strong>{complete ? "Opening your results" : "It is safe to step away"}</strong><p>{complete ? "Your evidence, weekly tasks, and results are saved." : "Destiny saves each checkpoint. The notification center and audit-ready email will link back to your completed strategy."}</p></div>
          {failed && <div className="processing-actions">{onRetry ? <button className="primary-button" onClick={onRetry} type="button">Review and try again</button> : <Link className="primary-button" href="/onboarding">Review and try again</Link>}<Link className="secondary-button" href="/">Back to home</Link></div>}
        </section>
      </div>
    </section>
  </main>;
}
