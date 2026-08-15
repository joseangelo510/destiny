import { WorkspaceLink as Link } from "./workspace-link";
import { CelebrationControls } from "./celebration-controls";
import { SeasonRecap } from "./founder-journey";
import type { SeasonSnapshot } from "../lib/product/founder-journey";
import type { buildSeoRoadmap } from "../lib/product/roadmap";
import type { buildWeeklyProgressSummary } from "../lib/quests/streak";

type RoadmapExperienceProps = {
  roadmap: Awaited<ReturnType<typeof buildSeoRoadmap>>;
  season?: SeasonSnapshot;
  weekly: Awaited<ReturnType<typeof buildWeeklyProgressSummary>>;
};

export function RoadmapExperience({ roadmap, season, weekly }: RoadmapExperienceProps) {
  const weekNumber = Math.max(1, weekly.lifetimeActiveWeeks + 1);
  const markerProgress = roadmap.pathProgress;
  const markerPosition = Math.max(7, Math.min(93, 7 + markerProgress * .86));
  const markerY = 28 - 22 * Math.pow(markerProgress / 100, 1.35);
  const markerTop = 35 + (markerY / 34) * 180 - 45;
  const currentDestination = markerProgress >= 67 ? 2 : markerProgress >= 34 ? 1 : 0;
  const nextAction = roadmap.currentTask
    ? {
      actionHref: roadmap.currentTask.actionHref,
      actionLabel: "Open task",
      label: roadmap.currentTask.label,
      description: roadmap.currentTask.detail,
    }
    : roadmap.currentNode ?? {
      actionHref: "/this-week",
      actionLabel: "Open this week",
      label: "Keep building what works",
      description: "Your current tasks are complete. Destiny will keep watching connected results while you continue the weekly loop.",
    };

  return <>
    <section className="apple-roadmap" aria-labelledby="apple-roadmap-title">
      <div className="apple-roadmap-copy">
        <span className="eyebrow">Your visibility journey · Week {weekNumber}</span>
        <h2 id="apple-roadmap-title">A clear path to being found.</h2>
        <p>Every completed task moves you forward. Verified results light the way.</p>
      </div>

      <div className="apple-roadmap-map" aria-label={`${roadmap.effortCompleted} of ${roadmap.effortTotal} tasks done`}>
        <svg className="apple-roadmap-route apple-roadmap-route-rising" viewBox="0 0 100 34" role="img" aria-label="Your work moving upward along the visibility journey" preserveAspectRatio="none">
          <defs>
            <linearGradient id="roadmap-ascent-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#6aa68e" stopOpacity=".14" />
              <stop offset="1" stopColor="#6aa68e" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path className="apple-roadmap-ascent-fill" d="M7 28 C30 28 38 24 52 20 C70 15 82 9 93 6 L93 34 L7 34 Z" />
          <path className="apple-roadmap-route-base" d="M7 28 C30 28 38 24 52 20 C70 15 82 9 93 6" pathLength="100" />
          <path className="apple-roadmap-route-progress" d="M7 28 C30 28 38 24 52 20 C70 15 82 9 93 6" pathLength="100" style={{ strokeDasharray: `${markerProgress} 100` }} />
          <circle className="apple-roadmap-marker-halo" cx={markerPosition} cy={markerY} r="4.2" />
          <circle className="apple-roadmap-marker" cx={markerPosition} cy={markerY} r="2.1" />
        </svg>
        <div className="apple-roadmap-position" style={{ left: `${markerPosition}%`, top: `${markerTop}px` }}><span>You are here <small>· {roadmap.effortCompleted} of {roadmap.effortTotal} tasks done</small></span></div>

        <div className="apple-roadmap-destinations apple-roadmap-destinations-rising">
          {roadmap.phases.map((phase, index) => {
            const completeTasks = phase.tasks.filter((task) => task.state === "complete").length;
            const verifiedSignals = phase.signals.filter((signal) => signal.state === "complete").length;
            const complete = phase.tasks.length > 0 && completeTasks === phase.tasks.length;
            const current = index === currentDestination && markerProgress < 100;
            return <article className={`${complete ? "complete" : ""} ${current ? "current" : ""}`} key={phase.id}>
              <span className="apple-roadmap-stop" aria-hidden="true">{complete ? "✓" : index + 1}</span>
              {current && <span className="apple-roadmap-mobile-position">You are here · {roadmap.effortCompleted} of {roadmap.effortTotal} tasks done</span>}
              <small>{phase.timing}</small>
              <h3>{phase.title}</h3>
              <p>{phase.description}</p>
              <span className="apple-roadmap-phase-proof">{completeTasks} of {phase.tasks.length} tasks · {verifiedSignals} verified</span>
            </article>;
          })}
        </div>
      </div>

      <div className="apple-roadmap-next">
        <div>
          <span>Your next step</span>
          <h3>{nextAction.label}</h3>
          <p>{nextAction.description}</p>
        </div>
        <Link className="primary-button" href={nextAction.actionHref}>{nextAction.actionLabel}</Link>
      </div>

      <div className="apple-roadmap-legend" aria-label="Progress key">
        <span><i className="effort" /> <strong>Your steps</strong> move the marker</span>
        <span><i className="outcome" /> <strong>Signs it’s working</strong> light up only when data confirms them</span>
      </div>
    </section>

    {season && <SeasonRecap snapshot={season} />}

    <section className="apple-roadmap-journey" aria-labelledby="roadmap-journey-title">
      <header>
        <span className="eyebrow">The work behind the path</span>
        <h2 id="roadmap-journey-title">Your journey</h2>
        <p>See every task that moves you forward and every real-world signal Destiny is waiting to verify.</p>
      </header>

      <div className="apple-roadmap-phase-list">
        {roadmap.phases.map((phase, index) => {
          const phaseComplete = phase.tasks.length > 0 && phase.tasks.every((task) => task.state === "complete");
          const phaseCurrent = phase.tasks.some((task) => task.state === "current") || (!roadmap.currentTask && index === currentDestination);
          const completeTasks = phase.tasks.filter((task) => task.state === "complete").length;
          return <section className={`apple-roadmap-phase ${phaseComplete ? "complete" : phaseCurrent ? "current" : "future"}`} key={phase.id}>
            <div className="apple-roadmap-phase-rail"><span>{phaseComplete ? "✓" : index + 1}</span></div>
            <div className="apple-roadmap-phase-body">
              <header>
                <div><small>{phase.timing}</small><h3>{phase.title}</h3></div>
                <span>{completeTasks} of {phase.tasks.length} tasks done</span>
              </header>

              <div className="apple-roadmap-phase-items">
                {phase.tasks.length > 0 ? phase.tasks.map((task) => <article className={`apple-roadmap-task-row ${task.state}`} key={task.id}>
                  <span className="apple-roadmap-row-mark" aria-hidden="true">{task.state === "complete" ? "✓" : task.state === "current" ? "→" : ""}</span>
                  <div><small>Week {task.weekNumber} · Your task</small><strong>{task.label}</strong>{task.state === "current" && <p>{task.detail}</p>}</div>
                  <div className="apple-roadmap-row-actions">
                    <span className="apple-roadmap-row-state">{task.state === "complete" ? "Done" : task.state === "current" ? "Current" : "Upcoming"}</span>
                    {phase.id === "ready" && <Link className={`apple-roadmap-row-action ${task.state}`} data-roadmap-action={task.id} href={task.actionHref}>{task.state === "complete" ? "Review" : task.state === "current" ? "Do this step" : "Open step"}</Link>}
                  </div>
                </article>) : <p className="apple-roadmap-phase-empty">Your next plan will add the tasks for this phase.</p>}

                {phase.signals.map((signal) => <article className={`apple-roadmap-signal-row ${signal.state === "complete" ? "verified" : "waiting"} ${phase.id === "ready" ? "actionable" : ""}`} key={signal.id}>
                  <span className="apple-roadmap-signal-mark" aria-hidden="true">◇</span>
                  <div><small>Sign it’s working</small><strong>{signal.label}</strong><p>{signal.evidence}</p></div>
                  <div className="apple-roadmap-row-actions">
                    <span className="apple-roadmap-row-state">{signal.state === "complete" ? "Verified" : "Not yet"}</span>
                    {phase.id === "ready" && <Link className="apple-roadmap-row-action signal" data-roadmap-signal-action={signal.id} href={signal.actionHref}>{signal.actionLabel}</Link>}
                  </div>
                </article>)}
              </div>
            </div>
          </section>;
        })}
      </div>
    </section>

    <details className="roadmap-explanation apple-roadmap-details">
      <summary><span><strong>How progress works</strong><small>Work moves your marker; connected evidence verifies results</small></span><b>View details</b></summary>
      <div className="roadmap-truth-key">
        <div><span className="effort-dot" /><strong>Your steps</strong><p>The marker moves when you complete work, such as fixing a page, approving keywords, or publishing content.</p></div>
        <div><span className="outcome-dot" /><strong>Verified results</strong><p>Result signals light up only when connected Search Console or Analytics data confirms them.</p></div>
      </div>
    </details>

    <details className="roadmap-momentum-drawer">
      <summary><span><strong>Your momentum history</strong><small>{weekly.currentStreak}-week streak · {weekly.perfectWeeks} Perfect Weeks</small></span><b>View history</b></summary>
      <section className="roadmap-momentum-grid" aria-label="Weekly momentum">
        {[
          [weekly.currentStreak, "Current streak", "Consecutive active weeks"],
          [weekly.bestStreak, "Best streak", "Longest saved weekly run"],
          [weekly.perfectWeeks, "Perfect Weeks", "Every assigned task completed"],
          [weekly.lifetimeActiveWeeks, "Lifetime active weeks", "Weeks with completed work"],
        ].map(([value, label, detail]) => <article key={String(label)}><strong>{Number(value)}</strong><span>{label}</span><small>{detail}</small></article>)}
      </section>
    </details>

    <CelebrationControls />
  </>;
}
