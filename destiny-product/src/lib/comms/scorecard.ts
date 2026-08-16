import type { ScorecardAttention, ScorecardMetric, ScorecardSnapshot, ScorecardWin, WeekState } from "./contracts";

export type ScorecardSource = {
  accountId: string;
  websiteId: string;
  messageId: string;
  weekNumber: number;
  streakLength: number;
  weekState: WeekState;
  freezesRemaining: number;
  metrics: ScorecardMetric[];
  wins?: ScorecardWin[];
  attention?: ScorecardAttention[];
  cta: ScorecardSnapshot["cta"];
  nextWeek: ScorecardSnapshot["nextWeek"];
  isFirstScorecard?: boolean;
  hasComparisonEvidence?: boolean;
  forceVariant?: ScorecardSnapshot["variant"];
};

function clamp<T>(values: T[], max: number) {
  return values.slice(0, max);
}

export function buildScorecardSnapshot(source: ScorecardSource): ScorecardSnapshot {
  const metrics = clamp(source.metrics.filter((metric) => metric.key.trim() && metric.label.trim() && metric.value.trim()), 4);
  const wins = clamp(source.wins ?? [], 3);
  const attention = clamp(source.attention ?? [], 1);
  const variant = source.forceVariant
    ?? (source.isFirstScorecard ? "first" : source.hasComparisonEvidence || wins.length > 0 ? "full" : "thin");
  const headline = variant === "first"
    ? "Your first Destiny Week is ready."
    : wins.length > 0
      ? `${wins.length} useful ${wins.length === 1 ? "step" : "steps"} moved forward this Week.`
      : source.weekState === "completed"
        ? "You kept the Week moving."
        : "Here is the clearest next move for this Week.";

  return {
    accountId: source.accountId,
    websiteId: source.websiteId,
    messageId: source.messageId,
    weekNumber: source.weekNumber,
    streakLength: Math.max(0, source.streakLength),
    weekState: source.weekState,
    freezesRemaining: Math.max(0, Math.min(2, source.freezesRemaining)),
    headline,
    metrics,
    wins,
    attention,
    cta: source.cta,
    nextWeek: source.nextWeek,
    variant,
  };
}

export function assertScorecardSnapshot(snapshot: ScorecardSnapshot) {
  if (!snapshot.accountId || !snapshot.websiteId || !snapshot.messageId) throw new Error("Scorecard identity fields are required.");
  if (snapshot.metrics.length > 4 || snapshot.wins.length > 3 || snapshot.attention.length > 1) throw new Error("Scorecard collection limits were exceeded.");
  if (!snapshot.cta.deepLink.startsWith("/") || snapshot.attention.some((item) => !item.deepLink.startsWith("/"))) {
    throw new Error("Scorecard actions must use exact app deep links.");
  }
  if (snapshot.cta.timeCostMinutes < 1 || snapshot.nextWeek.timeCostMinutes < 1) throw new Error("Scorecard actions need an honest time cost.");
  return snapshot;
}
