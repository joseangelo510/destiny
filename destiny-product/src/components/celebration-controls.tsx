"use client";

import { useEffect, useState } from "react";
import {
  CELEBRATION_KINDS,
  DEFAULT_CELEBRATION_PREFERENCES,
  playDestinySound,
  readCelebrationPreferences,
  saveCelebrationPreferences,
  type CelebrationKind,
  type CelebrationPreferences,
} from "../lib/product/celebrations";

const SOUND_LABELS: Record<CelebrationKind, string> = {
  task_complete: "Task tick",
  perfect_week: "Perfect Week",
  verified_result: "Verified result",
  roadmap_unlock: "Roadmap unlock",
};

export function CelebrationControls() {
  const [preferences, setPreferences] = useState<CelebrationPreferences>(DEFAULT_CELEBRATION_PREFERENCES);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = readCelebrationPreferences();
    document.documentElement.dataset.reducedCelebrations = String(saved.reduced);
    const hydrationTimer = window.setTimeout(() => {
      setPreferences(saved);
      setReady(true);
    }, 0);
    return () => window.clearTimeout(hydrationTimer);
  }, []);

  const update = (change: Partial<CelebrationPreferences>) => {
    const next = { ...preferences, ...change };
    setPreferences(next);
    saveCelebrationPreferences(next);
    document.documentElement.dataset.reducedCelebrations = String(next.reduced);
  };

  return <details className="celebration-controls workspace-card">
    <summary><span><strong>Sound & celebrations</strong><small>Original Rebound SEO feedback sounds with accessibility controls</small></span><b>Settings</b></summary>
    <div className="celebration-controls-body">
      <label><input checked={!preferences.muted} disabled={!ready} onChange={(event) => update({ muted: !event.target.checked })} type="checkbox" /><span><strong>Completion sounds</strong><small>Play a short sound after actions you trigger.</small></span></label>
      <label><input checked={preferences.reduced} disabled={!ready} onChange={(event) => update({ reduced: event.target.checked })} type="checkbox" /><span><strong>Reduced celebrations</strong><small>Keep feedback quieter and remove larger motion.</small></span></label>
      <div className="celebration-sound-preview"><span>Preview original sounds</span>{CELEBRATION_KINDS.map((kind) => <button disabled={preferences.muted} key={kind} onClick={() => void playDestinySound(kind)} type="button">{SOUND_LABELS[kind]}</button>)}</div>
    </div>
  </details>;
}
