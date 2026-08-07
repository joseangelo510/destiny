"use client";

import { useEffect, useMemo, useState } from "react";
import { WeeklyTaskList } from "./weekly-task-list";

type WeeklyLoopTask = {
  id: string;
  title: string;
  description: string;
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

export type WeeklyLoopGroup = {
  id: string;
  label: string;
  description: string;
  taskTypes: readonly string[];
  tasks: WeeklyLoopTask[];
};

const CATEGORY_ICONS: Record<string, string> = {
  "research-strategy": "⌁",
  "content-creation": "✎",
  distribution: "↗",
  "technical-seo": "⌗",
};

export function WeeklyLoop({
  auditId,
  currentStreak,
  currentTaskId = null,
  groups,
  initialFocusMode = false,
  initialRevealOpen = false,
  remainingTasks,
}: {
  auditId: string;
  currentStreak: number;
  currentTaskId?: string | null;
  groups: WeeklyLoopGroup[];
  initialFocusMode?: boolean;
  initialRevealOpen?: boolean;
  remainingTasks: number;
}) {
  const initialGroup = groups.find((group) => group.tasks.some((task) => task.id === currentTaskId))
    ?? groups.find((group) => group.tasks.some((task) => task.status === "todo" || task.status === "in_progress"))
    ?? groups[0];
  const [activeGroupId, setActiveGroupId] = useState(initialGroup?.id ?? "");
  const [focusMode, setFocusMode] = useState(initialFocusMode);
  const [revealOpen, setRevealOpen] = useState(initialRevealOpen);
  const activeGroup = groups.find((group) => group.id === activeGroupId) ?? groups[0];
  const allTasks = useMemo(() => groups.flatMap((group) => group.tasks), [groups]);
  const complete = allTasks.filter((task) => task.status === "complete").length;
  const focusTask = allTasks.find((task) => task.id === currentTaskId)
    ?? allTasks.find((task) => task.status === "in_progress")
    ?? allTasks.find((task) => task.status === "todo")
    ?? allTasks[0]
    ?? null;
  const revealStorageKey = `destiny-plan-reveal:${auditId}`;

  useEffect(() => {
    if (initialRevealOpen) return;
    const timer = window.setTimeout(() => {
      try {
        if (!window.localStorage.getItem(revealStorageKey)) setRevealOpen(true);
      } catch {
        setRevealOpen(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialRevealOpen, revealStorageKey]);

  const closeReveal = () => {
    setRevealOpen(false);
    try {
      window.localStorage.setItem(revealStorageKey, "seen");
    } catch {
      // The reveal still closes when browser storage is unavailable.
    }
  };

  const focusGroup = focusTask ? groups.find((group) => group.tasks.some((task) => task.id === focusTask.id)) ?? null : null;

  const startFromReveal = () => {
    if (focusGroup) setActiveGroupId(focusGroup.id);
    closeReveal();
  };

  const openTaskId = activeGroup?.tasks.find((task) => task.id === currentTaskId)?.id
    ?? activeGroup?.tasks.find((task) => task.status === "in_progress")?.id
    ?? activeGroup?.tasks.find((task) => task.status === "todo")?.id
    ?? activeGroup?.tasks[0]?.id
    ?? null;

  return <>
    <section className="weekly-loop" aria-labelledby="weekly-loop-title">
      <header className="weekly-loop-heading">
        <div>
          <span className="eyebrow">Your weekly SEO loop</span>
          <h2 id="weekly-loop-title">Four kinds of work build your visibility.</h2>
          <p>Choose a category to see exactly what Destiny recommends this week.</p>
        </div>
        <div className="weekly-loop-summary" aria-label={`${complete} of ${allTasks.length} weekly tasks complete`}>
          <strong>{complete > 0 ? `${complete} of ${allTasks.length}` : allTasks.length}</strong>
          <span>{complete > 0 ? "complete this week" : "tasks this week"}</span>
          <small>{currentStreak}-week streak</small>
          {!focusMode && focusTask && <button className="overwhelm-button" onClick={() => setFocusMode(true)} type="button"><span aria-hidden="true">♡</span> I’m overwhelmed</button>}
        </div>
      </header>

      {focusMode && focusTask ? <section aria-labelledby="focus-mode-title" className="weekly-focus-mode">
        <header><span className="weekly-focus-orbit" aria-hidden="true">✦</span><div><span className="eyebrow">One small step is enough</span><h3 id="focus-mode-title">I hear you. Let’s make this smaller.</h3><p>Ignore the rest for now. This is the most useful next step Destiny already selected from your plan.</p></div><button className="text-button" onClick={() => setFocusMode(false)} type="button">Show my full week</button></header>
        <div className="weekly-focus-time"><span>One step</span><strong>about {focusTask.estimated_minutes} minutes</strong></div>
        <WeeklyTaskList openTaskId={focusTask.id} remainingTasks={remainingTasks} tasks={[focusTask]} />
      </section> : <>
      <div className="weekly-loop-tabs" role="tablist" aria-label="Weekly SEO work">
        {groups.map((group, index) => {
          const groupComplete = group.tasks.filter((task) => task.status === "complete").length;
          const active = group.id === activeGroup?.id;
          return <button aria-controls="weekly-loop-task-pane" aria-selected={active} className={active ? "active" : ""} id={`weekly-loop-tab-${group.id}`} key={group.id} onClick={() => setActiveGroupId(group.id)} role="tab" type="button">
            <span className={`weekly-loop-icon category-${index + 1}`}>{CATEGORY_ICONS[group.id] ?? index + 1}</span>
            <span><small>0{index + 1}</small><strong>{group.label}</strong><em>{groupComplete > 0 ? `${groupComplete} of ${group.tasks.length} complete` : `${group.tasks.length} ${group.tasks.length === 1 ? "task" : "tasks"}`}</em></span>
          </button>;
        })}
      </div>

      {activeGroup && <section aria-labelledby={`weekly-loop-tab-${activeGroup.id}`} className="weekly-loop-task-pane" id="weekly-loop-task-pane" role="tabpanel">
        <div className="weekly-loop-pane-intro"><span className="eyebrow">{focusGroup && activeGroup.id === focusGroup.id ? "Start here" : "Now viewing"}</span><p>{activeGroup.description}</p>{focusGroup && activeGroup.id === focusGroup.id && <small className="weekly-loop-start-here-note">Your next move is based on what the audit found.</small>}</div>
        {activeGroup.tasks.length > 0
          ? <WeeklyTaskList openTaskId={openTaskId} remainingTasks={remainingTasks} tasks={activeGroup.tasks} />
          : <div className="weekly-loop-empty"><strong>No task needed here this week.</strong><p>Destiny will add work when your strategy or connected data shows a useful next step.</p></div>}
      </section>}
      </>}
    </section>

    <a className="weekly-plan-reveal-audit-link" href={`/audits/${auditId}`}>See full audit details</a>

    <button className="weekly-plan-replay" onClick={() => setRevealOpen(true)} type="button"><span>✦</span><span><small>Post-audit orientation</small><strong>Replay plan reveal</strong></span></button>

    {revealOpen && <div className="weekly-plan-reveal-backdrop" role="presentation">
      <section aria-labelledby="weekly-plan-reveal-title" aria-modal="true" className="weekly-plan-reveal" role="dialog">
        <button aria-label="Close plan reveal" className="weekly-plan-reveal-close" onClick={closeReveal} type="button">×</button>
        <div className="weekly-plan-reveal-compass" aria-hidden="true">✦</div>
        <span className="eyebrow">Your audit is complete</span>
        <h2 id="weekly-plan-reveal-title">Your audit is done. Here’s your plan.</h2>
        <p>Destiny turned your saved research into a focused weekly plan. You do not need to do everything at once.</p>
        <div className="weekly-plan-reveal-list">{groups.map((group, index) => <div key={group.id}><span>{index + 1}</span><p><strong>{group.label}</strong><small>{group.description}</small>{focusGroup?.id === group.id && <small className="weekly-plan-reveal-start-here">Start here — your next move is based on what the audit found.</small>}</p></div>)}</div>
        <button className="primary-button" onClick={startFromReveal} type="button">{focusTask ? `Start: ${focusTask.title}` : "See your first task"}</button>
      </section>
    </div>}
  </>;
}
