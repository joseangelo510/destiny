export type WeekState = "open" | "completed" | "at_risk" | "frozen" | "recovering" | "recovered" | "broken";

export type CommsCadence = "essential" | "weekly" | "guided" | "muted";

export type NotificationJob = "continuity" | "reflection" | "direction" | "celebration" | "alarm" | "discovery";

export type NotificationPriority = 0 | 1 | 2;

export type NotificationEventType =
  | "quest.action_completed"
  | "week.completed"
  | "week.at_risk"
  | "week.last_chance"
  | "week.frozen"
  | "week.recovery_offered"
  | "week.recovered"
  | "week.broken"
  | "scorecard.ready"
  | "onboarding.step_ready"
  | "alarm.indexation_collapse"
  | "alarm.crawl_blocked"
  | "alarm.money_keyword_drop";

export type NotificationRender = {
  title: string;
  objectName?: string;
  objectUrl?: string;
  delta?: string;
  timeCostMinutes?: number;
};

export type NotificationEvent = {
  eventId: string;
  accountId: string;
  websiteId: string;
  userId: string;
  occurredAtUtc: string;
  userTimezone: string;
  type: NotificationEventType;
  job: NotificationJob;
  priority: NotificationPriority;
  groupingKey: string;
  dedupeKey: string;
  bypassBatch: boolean;
  render: NotificationRender;
  payload: Record<string, unknown>;
};

export type ScorecardMetric = {
  key: string;
  label: string;
  value: string;
  delta: string | null;
  direction: "up" | "down" | "flat" | "unknown";
  sparkline: number[];
};

export type ScorecardWin = {
  objectName: string;
  objectUrl: string;
  from: string;
  to: string;
  metric: string;
};

export type ScorecardAttention = {
  problem: string;
  cause: string;
  fix: string;
  timeCostMinutes: number;
  deepLink: string;
};

export type ScorecardSnapshot = {
  accountId: string;
  websiteId: string;
  messageId: string;
  weekNumber: number;
  streakLength: number;
  weekState: WeekState;
  freezesRemaining: number;
  headline: string;
  metrics: ScorecardMetric[];
  wins: ScorecardWin[];
  attention: ScorecardAttention[];
  cta: { label: string; deepLink: string; timeCostMinutes: number };
  nextWeek: { weekNumber: number; actionsRequired: number; timeCostMinutes: number };
  variant: "full" | "thin" | "first";
};

export const ALARM_EVENT_TYPES = new Set<NotificationEventType>([
  "alarm.indexation_collapse",
  "alarm.crawl_blocked",
  "alarm.money_keyword_drop",
]);

export function eventRoute(type: NotificationEventType): Pick<NotificationEvent, "job" | "priority" | "bypassBatch"> {
  if (ALARM_EVENT_TYPES.has(type)) return { job: "alarm", priority: 2, bypassBatch: true };
  if (type === "scorecard.ready") return { job: "reflection", priority: 1, bypassBatch: false };
  if (type === "onboarding.step_ready") return { job: "direction", priority: 0, bypassBatch: false };
  if (type === "quest.action_completed" || type === "week.completed" || type === "week.recovered") {
    return { job: "celebration", priority: 0, bypassBatch: false };
  }
  return { job: "continuity", priority: 1, bypassBatch: false };
}
