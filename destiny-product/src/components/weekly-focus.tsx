import Link from "next/link";
import { displayTaskTitle, guidedTaskPath, isReviewTask, taskRoadmapTarget } from "../lib/product/coach-experience";

export type WeeklyFocusTask = {
  id: string;
  title: string;
  description: string;
  category?: string | null;
  status: string;
  action_path: string;
  estimated_minutes: number;
  task_type: string;
};

export function WeeklyFocus({
  completed,
  currentStreak,
  task,
  total,
}: {
  completed: number;
  currentStreak: number;
  task: WeeklyFocusTask | null;
  total: number;
}) {
  const safeTotal = Math.max(total, 1);
  const percent = Math.min(100, Math.round((completed / safeTotal) * 100));
  const complete = total > 0 && completed === total;
  const streakLabel = `${currentStreak}-week streak`;

  if (!task) {
    return <section className={`weekly-focus ${complete ? "complete" : "paused"}`}>
      <div className="weekly-focus-copy">
        <span className="eyebrow">{complete ? "This week is complete" : "Your plan is paused"}</span>
        <h2>{complete ? "A complete week, built one useful step at a time." : "There is no open step competing for your attention."}</h2>
        <p>{complete ? "You completed every assigned step. Destiny will keep reported work separate from outcomes verified by connected data." : "Skipped work stays available in the checklist below whenever you are ready to return to it."}</p>
        <div className="weekly-focus-actions">
          <Link className="primary-button" href={complete ? "/roadmap" : "#weekly-checklist"}>{complete ? "Review the ground you covered" : "Review the checklist"}</Link>
          <Link className="text-button" href="/analytics">See verified results</Link>
        </div>
      </div>
      <WeeklyFocusProgress completed={completed} percent={percent} streakLabel={streakLabel} total={total} />
    </section>;
  }

  return <section className="weekly-focus">
    <div className="weekly-focus-copy">
      <span className="eyebrow">Your next useful step</span>
      <h2>{displayTaskTitle(task)}</h2>
      <p>{task.description}</p>
      <div className="weekly-focus-meta"><span>{task.estimated_minutes} minutes</span><span>Moves you toward {taskRoadmapTarget(task.task_type)}</span></div>
      <div className="weekly-focus-actions"><Link className="primary-button" href={guidedTaskPath(task)}>{isReviewTask(task) ? "Open reviews" : "Begin this step"}</Link><a className="text-button" href="#weekly-checklist">See the full week</a></div>
    </div>
    <WeeklyFocusProgress completed={completed} percent={percent} streakLabel={streakLabel} total={total} />
  </section>;
}

function WeeklyFocusProgress({ completed, percent, streakLabel, total }: { completed: number; percent: number; streakLabel: string; total: number }) {
  return <aside className="weekly-focus-progress" aria-label="Weekly progress">
    <span>{completed} of {total} complete</span>
    <div aria-label={`${percent}% of this week's plan complete`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={percent} className="weekly-focus-track" role="progressbar"><i style={{ width: `${percent}%` }} /></div>
    <strong>{streakLabel}</strong>
    <small>One completed step keeps the weekly rhythm going.</small>
  </aside>;
}
