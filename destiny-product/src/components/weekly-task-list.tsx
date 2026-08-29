"use client";

import { WorkspaceLink as Link } from "./workspace-link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { coachingTaskCopy, completionPresentation, guidedTaskPath, isReviewTask, taskRoadmapTarget } from "../lib/product/coach-experience";
import { celebrationMessage, playDestinySound, type CelebrationKind } from "../lib/product/celebrations";
import { guidancePresentation } from "../lib/quests/guidance-state";

type WeeklyTask = {
  id: string;
  title: string;
  description: string;
  category?: string | null;
  status: string;
  action_path: string;
  estimated_minutes: number;
  requires_approval: boolean;
  external_url: string | null;
  task_type: string;
  verification_status: string;
  verification_method: string | null;
  verified_at: string | null;
  guidance_state?: string | null;
  follow_up_at?: string | null;
  blocker_reason?: string | null;
  blocker_owner?: string | null;
};

export function WeeklyTaskList({ auditId, openTaskId, tasks }: { auditId: string; openTaskId: string | null; tasks: WeeklyTask[]; remainingTasks?: number }) {
  const router = useRouter();
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [celebration, setCelebration] = useState<{ kind: CelebrationKind; title: string; detail: string } | null>(null);
  const [justCompleted, setJustCompleted] = useState<string | null>(null);
  useEffect(() => {
    if (!celebration) return;
    const timer = window.setTimeout(() => setCelebration(null), 4200);
    return () => window.clearTimeout(timer);
  }, [celebration]);
  const update = async (task: WeeklyTask, status: "complete" | "skipped" | "todo") => {
    setSaving(task.id);
    setError("");
    const response = await fetch(`/api/quests/${encodeURIComponent(task.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    const payload = await response.json() as { error?: string; celebration?: CelebrationKind | "none"; quest?: { verification_status?: string } };
    if (!response.ok) setError(payload.error || "Rebound SEO could not update the task.");
    else {
      if (status === "complete") {
        const kind: CelebrationKind = payload.celebration && payload.celebration !== "none" ? payload.celebration : "task_complete";
        void playDestinySound(kind);
        setCelebration({ kind, ...celebrationMessage(kind) });
        setJustCompleted(task.id);
      }
      router.refresh();
    }
    setSaving(null);
  };
  const approveRecommendedKeywords = async (task: WeeklyTask) => {
    setSaving(task.id);
    setError("");
    try {
      const response = await fetch("/api/keywords/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auditId, approveRecommended: true }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Rebound SEO could not approve the recommended keywords.");
      await update(task, "complete");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Rebound SEO could not approve the recommended keywords.");
      setSaving(null);
    }
  };
  return <section className="weekly-task-stack">
    {tasks.map((task, index) => {
      const completion = completionPresentation(task);
      const copy = coachingTaskCopy(task);
      const doneLooksLike = task.external_url
        ? "You open the live conversation, contribute a useful response, and return here to mark it complete."
        : task.task_type === "keyword_review"
        ? "At least five recommended searches are approved for the first content plan. You do not need to decide every recommendation."
        : task.task_type === "content_review"
        ? "Three article drafts are reviewed and approved for CMS or editable-document delivery."
        : task.task_type === "community_distribution"
        ? "You contribute useful answers to three verified Reddit or Quora threads."
        : task.task_type === "social_distribution"
        ? "You share an approved article on LinkedIn and X with your own context."
        : task.task_type === "publisher_outreach"
        ? "You contact three non-competing publishers after reviewing each outreach draft."
        : task.task_type === "directory_growth"
        ? "You complete one directory profile or request three honest customer or partner reviews."
        : task.task_type === "technical_review"
        ? "You run the deferred PageSpeed check, review the technical findings, and choose the next website fix."
        : isReviewTask(task)
        ? "You choose the review source that fits your business and complete one review-building action."
        : task.requires_approval
        ? "You review the prepared work, approve it, and mark the task complete."
        : "You make the recommended change and mark it complete; Rebound SEO will verify it when evidence is available.";
      return <details className={`weekly-task ${task.status} ${justCompleted === task.id ? "just-completed" : ""}`} data-task-id={task.id} key={task.id} open={task.id === openTaskId}>
      <summary><span className="task-number">{task.status === "complete" ? "✓" : task.status === "skipped" ? "–" : index + 1}</span><span><strong>{copy.title}</strong><small>{task.estimated_minutes} min · {task.requires_approval ? "Your confirmation required" : "Guided action"}</small><em>This moves you toward → {taskRoadmapTarget(task.task_type)}</em></span><b className={`completion-state ${completion.tone}`}>{completion.label}</b></summary>
      <div className="weekly-task-body"><p><strong>Why this matters:</strong> {copy.description}</p><p><strong>What done looks like:</strong> {doneLooksLike}</p>{task.status === "complete" && <div className={`completion-proof ${completion.tone}`}><strong>{completion.label}</strong><span>{completion.detail}</span>{task.verified_at && <small>{task.verification_method === "user_confirmation" ? "Verified by your confirmation" : "Evidence verified by Rebound SEO"} · {new Date(task.verified_at).toLocaleDateString()}</small>}</div>}<div className="weekly-task-actions">
        <Link className="primary-button" href={guidedTaskPath(task)}>{task.task_type === "keyword_review" ? task.status === "complete" ? "Review saved strategy" : "Review keywords" : isReviewTask(task) ? "Open reviews" : "Open guided step"}</Link>
        {task.status !== "complete" && task.task_type === "keyword_review" && <button className="secondary-button" disabled={saving === task.id} onClick={() => void approveRecommendedKeywords(task)} type="button">{saving === task.id ? "Approving…" : "Approve Rebound SEO’s 5"}</button>}
        {task.external_url && <a className="secondary-button" href={task.external_url} rel="noreferrer" target="_blank">{task.task_type === "technical_review" ? "Open PageSpeed Insights ↗" : "Open live thread ↗"}</a>}
        {task.status !== "complete" && task.task_type !== "keyword_review" && <button className="secondary-button" disabled={saving === task.id} onClick={() => void update(task, "complete")} type="button">{saving === task.id ? "Saving…" : task.requires_approval ? "Approve & complete" : "Mark done"}</button>}
        {task.status === "complete" && <button className="secondary-button" disabled={saving === task.id} onClick={() => void update(task, "todo")} type="button">Reopen</button>}
        {!new Set(["primary_quest", "keyword_review"]).has(task.task_type) && task.status !== "skipped" && task.status !== "complete" && <button className="text-button" disabled={saving === task.id} onClick={() => void update(task, "skipped")} type="button">Skip for now</button>}
      </div></div>
      {(task.guidance_state === "waiting" || task.guidance_state === "blocked") && <div className={`guided-task-state ${task.guidance_state}`}><strong>{guidancePresentation(task).label}</strong><span>{guidancePresentation(task).detail}</span></div>}
    </details>;
    })}
    {celebration && <div aria-live="polite" className={`destiny-celebration ${celebration.kind}`}><span>⌁</span><p><strong>{celebration.title}</strong><small>{celebration.detail}</small></p><Link href="/roadmap">View roadmap →</Link></div>}
    {error && <div className="error-banner">{error}</div>}
  </section>;
}
