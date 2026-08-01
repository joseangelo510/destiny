const weekMilliseconds = 7 * 24 * 60 * 60 * 1000;

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
