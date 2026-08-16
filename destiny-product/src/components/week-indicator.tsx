import type { WeekState } from "@/lib/comms/contracts";

const PRESENTATION: Record<WeekState, { label: string; detail: string; tone: string; symbol: string }> = {
  open: { label: "Week open", detail: "Complete one useful task before Monday.", tone: "open", symbol: "○" },
  completed: { label: "Week safe", detail: "One useful action kept your streak moving.", tone: "safe", symbol: "✓" },
  at_risk: { label: "Week at risk", detail: "One useful task still protects this Week.", tone: "risk", symbol: "!" },
  frozen: { label: "Freeze used", detail: "Your streak was protected automatically.", tone: "frozen", symbol: "❄" },
  recovering: { label: "48-hour recovery", detail: "Complete two useful actions before recovery closes.", tone: "risk", symbol: "↻" },
  recovered: { label: "Week recovered", detail: "Two useful actions restored your momentum.", tone: "safe", symbol: "✓" },
  broken: { label: "Start a new Week", detail: "The prior streak ended. One useful task begins again.", tone: "broken", symbol: "○" },
};

export function WeekIndicator({ achievementEarned = false, freezesRemaining, state, streakLength }: { achievementEarned?: boolean; freezesRemaining: number; state: WeekState; streakLength: number }) {
  const view = PRESENTATION[state];
  return <section className={`week-indicator ${view.tone}`} aria-label={`${view.label}. ${view.detail}`}>
    <div className="week-indicator-status"><span aria-hidden="true">{view.symbol}</span><p><strong>{view.label}</strong><small>{view.detail}</small></p></div>
    <dl><div><dt>Streak</dt><dd>{streakLength} {streakLength === 1 ? "Week" : "Weeks"}</dd></div><div><dt>Freezes</dt><dd>{freezesRemaining} of 2</dd></div></dl>
    {achievementEarned ? <div className="day-zero-achievement"><span aria-hidden="true">⌁</span><p><strong>First useful step</strong><small>Day-zero achievement earned</small></p></div> : null}
  </section>;
}
