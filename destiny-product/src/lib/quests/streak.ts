const weekMilliseconds = 7 * 24 * 60 * 60 * 1000;
const excludedTaskTypes = new Set(["business_confirmation", "vocabulary_review"]);

function mondayUtc(value: Date) {
  const date = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return date.getTime();
}

/** Consecutive completion weeks, allowing the current week to be unfinished. */
export function calculateWeeklyStreak(completedAt: Array<string | null>, now = new Date()) {
  const weeks = new Set(completedAt.flatMap((value) => {
    if (!value) return [];
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? [] : [mondayUtc(date)];
  }));
  if (!weeks.size) return 0;

  let cursor = mondayUtc(now);
  if (!weeks.has(cursor)) cursor -= weekMilliseconds;
  let streak = 0;
  while (weeks.has(cursor)) {
    streak += 1;
    cursor -= weekMilliseconds;
  }
  return streak;
}

type WeeklyProgressTask = {
  audit_id: string | null;
  week_number: number;
  task_type: string;
  status: string;
  completed_at: string | null;
  created_at: string;
};

function validCompletionWeeks(completedAt: Array<string | null>) {
  return [...new Set(completedAt.flatMap((value) => {
    if (!value) return [];
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? [] : [mondayUtc(date)];
  }))].sort((left, right) => left - right);
}

function longestWeeklyStreak(weeks: number[]) {
  let longest = 0;
  let running = 0;
  let previous: number | null = null;
  for (const week of weeks) {
    running = previous !== null && week - previous === weekMilliseconds ? running + 1 : 1;
    longest = Math.max(longest, running);
    previous = week;
  }
  return longest;
}

export function buildWeeklyProgressSummary(tasks: WeeklyProgressTask[], now = new Date()) {
  const actionable = tasks.filter((task) => !excludedTaskTypes.has(task.task_type));
  const weeks = validCompletionWeeks(actionable.map((task) => task.completed_at));
  const plans = new Map<string, WeeklyProgressTask[]>();
  for (const task of actionable) {
    const created = new Date(task.created_at);
    const fallbackWeek = Number.isNaN(created.getTime()) ? task.created_at : String(mondayUtc(created));
    const key = `${task.audit_id || fallbackWeek}:${task.week_number}`;
    plans.set(key, [...(plans.get(key) ?? []), task]);
  }
  const perfectWeeks = [...plans.values()].filter((plan) => plan.length > 0 && plan.every((task) => task.status === "complete")).length;
  return {
    currentStreak: calculateWeeklyStreak(actionable.map((task) => task.completed_at), now),
    bestStreak: longestWeeklyStreak(weeks),
    perfectWeeks,
    lifetimeActiveWeeks: weeks.length,
  };
}
