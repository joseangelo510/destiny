"use client";

import { useState } from "react";
import type { DiscoveryMoment, SeasonSnapshot, WitnessEntry } from "../lib/product/founder-journey";

export function DiscoveryMomentCard({ moment }: { moment: DiscoveryMoment | null }) {
  if (!moment) return null;
  return <section aria-label="Connected discovery moment" className="discovery-moment-card">
    <div className="discovery-moment-spark" aria-hidden="true">✦</div>
    <div className="discovery-moment-copy">
      <span className="eyebrow">A real sign of momentum</span>
      <h2>{moment.title}</h2>
      <p>{moment.detail}</p>
      <small>{moment.source} · Verified connected data</small>
    </div>
    <div className="discovery-moment-value"><strong>{moment.value}</strong><span>{moment.label}</span></div>
  </section>;
}

export function WitnessLog({ entries }: { entries: WitnessEntry[] }) {
  return <section aria-labelledby="witness-log-title" className="witness-log">
    <header>
      <div><span className="eyebrow">Your effort is visible here</span><h2 id="witness-log-title">Rebound SEO noticed.</h2></div>
      <p>A quiet record of the work you completed and the results connected data confirmed.</p>
    </header>
    {entries.length ? <div className="witness-log-list">{entries.map((entry) => <article className={`witness-entry ${entry.tone}`} key={entry.id}>
      <span className="witness-entry-mark" aria-hidden="true">{entry.tone === "verified" ? "✓" : "•"}</span>
      <div><strong>{entry.title}</strong><p>{entry.detail}</p><small>{entry.source}</small></div>
      <span className="witness-entry-proof">{entry.proof}</span>
    </article>)}</div> : <div className="witness-log-empty"><strong>Your first entry is ahead.</strong><p>Complete one useful step and Rebound SEO will remember the momentum with you.</p></div>}
  </section>;
}

export function FounderWhyVault({ initialWhy }: { initialWhy: string }) {
  const [why, setWhy] = useState(initialWhy);
  const [baseline, setBaseline] = useState(initialWhy);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const changed = why.trim() !== baseline.trim();

  const save = async () => {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/founder-why", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ founderWhy: why }),
      });
      const payload = await response.json() as { error?: string; founderWhy?: string };
      if (!response.ok) throw new Error(payload.error || "Rebound SEO could not save your why.");
      const saved = payload.founderWhy ?? why.trim();
      setWhy(saved);
      setBaseline(saved);
      setMessage("Your why is safe here.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Rebound SEO could not save your why.");
    } finally {
      setSaving(false);
    }
  };

  return <details className="founder-why-vault">
    <summary><span className="founder-why-vault-icon" aria-hidden="true">◇</span><span><small>Private to your workspace</small><strong>Your Why Vault</strong><em>A reminder of what this business makes possible.</em></span><b>{initialWhy ? "Open" : "Add yours"}</b></summary>
    <div className="founder-why-vault-body">
      <label htmlFor="founder-why">Why does this business matter to you?</label>
      <p>This is optional and separate from onboarding. Keep one honest sentence here for the hard weeks.</p>
      <textarea id="founder-why" maxLength={1000} onChange={(event) => setWhy(event.target.value)} placeholder="I started this business because…" rows={4} value={why} />
      <div className="founder-why-vault-actions"><button className="secondary-button" disabled={saving || !changed || why.trim().length > 0 && why.trim().length < 12} onClick={() => void save()} type="button">{saving ? "Saving…" : "Save my why"}</button><small>{why.trim().length}/1000</small></div>
      <div aria-live="polite" className="founder-why-vault-status" role="status">{message && <p>{message}</p>}{error && <p className="form-error">{error}</p>}</div>
    </div>
  </details>;
}

export function SeasonRecap({ snapshot }: { snapshot: SeasonSnapshot }) {
  const progress = Math.round((snapshot.currentWeek / snapshot.totalWeeks) * 100);
  return <section aria-labelledby="season-recap-title" className="season-recap">
    <div className="season-recap-copy"><span className="eyebrow">Your 90-day season</span><h2 id="season-recap-title">Week {snapshot.currentWeek} of {snapshot.totalWeeks}</h2><p>This is what your consistent work has built so far. No projections—only saved effort and verified evidence.</p></div>
    <div className="season-recap-progress" aria-label={`${progress}% through the current 90-day season`}><span style={{ width: `${progress}%` }} /></div>
    <div className="season-recap-stats">
      <article><strong>{snapshot.completedTasks}</strong><span>tasks completed</span></article>
      <article><strong>{snapshot.verifiedResults}</strong><span>verified results</span></article>
      <article><strong>{snapshot.activeWeeks}</strong><span>active weeks</span></article>
    </div>
    <small className="season-recap-truth">No projections · No invented milestones</small>
  </section>;
}
