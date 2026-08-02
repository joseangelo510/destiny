"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type WeeklyTask = {
  id: string;
  title: string;
  description: string;
  status: string;
  action_path: string;
  estimated_minutes: number;
  requires_approval: boolean;
  external_url: string | null;
  xp: number;
};

export function WeeklyTaskList({ tasks }: { tasks: WeeklyTask[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const firstIncomplete = Math.max(0, tasks.findIndex((task) => task.status === "todo" || task.status === "in_progress"));
  const update = async (task: WeeklyTask, status: "complete" | "skipped" | "todo") => {
    setSaving(task.id);
    setError("");
    const response = await fetch(`/api/quests/${encodeURIComponent(task.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    const payload = await response.json() as { error?: string };
    if (!response.ok) setError(payload.error || "Destiny could not update the task.");
    else router.refresh();
    setSaving(null);
  };
  return <section className="weekly-task-stack">
    {tasks.map((task, index) => <details className={`weekly-task ${task.status}`} key={task.id} open={index === firstIncomplete}>
      <summary><span className="task-number">{task.status === "complete" ? "✓" : task.status === "skipped" ? "–" : index + 1}</span><span><strong>{task.title}</strong><small>{task.estimated_minutes} min · {task.requires_approval ? "Your approval required" : `+${task.xp} XP`}</small></span><b>{task.status.replaceAll("_", " ")}</b></summary>
      <div className="weekly-task-body"><p><strong>Why this matters:</strong> {task.description}</p><div className="weekly-task-actions">
        <Link className="primary-button" href={task.action_path}>Open guided step</Link>
        {task.external_url && <a className="secondary-button" href={task.external_url} rel="noreferrer" target="_blank">Open live thread ↗</a>}
        {task.status !== "complete" && <button className="secondary-button" disabled={saving === task.id} onClick={() => void update(task, "complete")} type="button">{saving === task.id ? "Saving…" : task.requires_approval ? "Approve & complete" : "Mark done"}</button>}
        {task.status === "complete" && <button className="secondary-button" disabled={saving === task.id} onClick={() => void update(task, "todo")} type="button">Reopen</button>}
        {task.status !== "skipped" && task.status !== "complete" && <button className="text-button" disabled={saving === task.id} onClick={() => void update(task, "skipped")} type="button">Skip for now</button>}
      </div></div>
    </details>)}
    {error && <div className="error-banner">{error}</div>}
  </section>;
}
