"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { guidancePresentation } from "../lib/quests/guidance-state";

type PausedTask = { id: string; title: string; guidance_state?: string | null; follow_up_at?: string | null; blocker_reason?: string | null; blocker_owner?: string | null };

export function PausedWorkList({ tasks }: { tasks: PausedTask[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  if (!tasks.length) return null;
  const resume = async (id: string) => {
    setSaving(id);
    setError("");
    try {
      const response = await fetch(`/api/quests/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ guidanceState: "active" }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Destiny could not resume this task.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Destiny could not resume this task.");
    } finally {
      setSaving(null);
    }
  };
  return <section className="paused-work-list" aria-label="Paused work"><header><span className="eyebrow">Paused work</span><h2>Nothing is lost—these are waiting for the right moment.</h2></header>{tasks.map((task) => {
    const state = guidancePresentation(task);
    return <article className={state.tone} key={task.id}><div><strong>{task.title}</strong><span>{state.label}</span><p>{state.detail}</p></div><button className="secondary-button" disabled={saving === task.id} onClick={() => void resume(task.id)} type="button">{saving === task.id ? "Resuming…" : "Resume task"}</button></article>;
  })}{error && <p className="task-state-error">{error}</p>}</section>;
}
