import type { WeekState } from "./contracts";

const DAY_MS = 24 * 60 * 60 * 1000;

export type WeekWindow = {
  localWeekStart: string;
  weekNumber: number;
  windowStartAt: string;
  fridayRiskAt: string;
  sundayLastChanceAt: string;
  windowEndAt: string;
  userTimezone: string;
};

export type WeekContinuity = WeekWindow & {
  state: WeekState;
  streakLength: number;
  qualifyingActionCount: number;
  recoveryActionCount: number;
  recoveryExpiresAt: string | null;
  freezesRemaining: number;
  freezesResetAt: string;
};

export type WeekTransition = {
  continuity: WeekContinuity;
  emitted: Array<"week.completed" | "week.at_risk" | "week.last_chance" | "week.frozen" | "week.recovery_offered" | "week.recovered" | "week.broken">;
};

type ZonedParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

function formatter(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
}

function zonedParts(value: Date, timeZone: string): ZonedParts {
  const values = Object.fromEntries(formatter(timeZone).formatToParts(value).map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function timeZoneOffsetMs(value: Date, timeZone: string) {
  const parts = zonedParts(value, timeZone);
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - value.getTime();
}

function zonedDateTimeToUtc(parts: ZonedParts, timeZone: string) {
  const desired = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  let guess = desired;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    guess = desired - timeZoneOffsetMs(new Date(guess), timeZone);
  }
  return new Date(guess);
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addUtcDays(parts: Pick<ZonedParts, "year" | "month" | "day">, days: number) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function isoWeekNumber(parts: Pick<ZonedParts, "year" | "month" | "day">) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / DAY_MS) + 1) / 7);
}

function assertTimeZone(timeZone: string) {
  try {
    formatter(timeZone).format(new Date(0));
  } catch {
    throw new Error(`Invalid IANA time zone: ${timeZone}`);
  }
}

export function weekWindowAt(now: Date, userTimezone: string): WeekWindow {
  assertTimeZone(userTimezone);
  const local = zonedParts(now, userTimezone);
  const localDate = new Date(Date.UTC(local.year, local.month - 1, local.day));
  const daysSinceMonday = (localDate.getUTCDay() + 6) % 7;
  const monday = addUtcDays(local, -daysSinceMonday);
  const friday = addUtcDays(monday, 4);
  const sunday = addUtcDays(monday, 6);
  const nextMonday = addUtcDays(monday, 7);
  const toIso = (date: { year: number; month: number; day: number }, hour: number, minute = 0) => zonedDateTimeToUtc({ ...date, hour, minute, second: 0 }, userTimezone).toISOString();
  return {
    localWeekStart: dateKey(monday.year, monday.month, monday.day),
    weekNumber: isoWeekNumber(monday),
    windowStartAt: toIso(monday, 0),
    fridayRiskAt: toIso(friday, 12),
    sundayLastChanceAt: toIso(sunday, 17),
    windowEndAt: toIso(nextMonday, 0),
    userTimezone,
  };
}

export function nextQuarterResetAt(now: Date, userTimezone: string) {
  const local = zonedParts(now, userTimezone);
  const nextQuarterMonth = Math.floor((local.month - 1) / 3) * 3 + 4;
  const year = local.year + (nextQuarterMonth > 12 ? 1 : 0);
  const month = ((nextQuarterMonth - 1) % 12) + 1;
  return zonedDateTimeToUtc({ year, month, day: 1, hour: 0, minute: 0, second: 0 }, userTimezone).toISOString();
}

export function createWeekContinuity(now: Date, userTimezone: string, previous?: Pick<WeekContinuity, "streakLength" | "freezesRemaining" | "freezesResetAt">): WeekContinuity {
  const window = weekWindowAt(now, userTimezone);
  const resetExpired = !previous || new Date(previous.freezesResetAt).getTime() <= now.getTime();
  return {
    ...window,
    state: "open",
    streakLength: previous?.streakLength ?? 0,
    qualifyingActionCount: 0,
    recoveryActionCount: 0,
    recoveryExpiresAt: null,
    freezesRemaining: resetExpired ? 2 : previous.freezesRemaining,
    freezesResetAt: resetExpired ? nextQuarterResetAt(now, userTimezone) : previous.freezesResetAt,
  };
}

export function advanceWeek(continuity: WeekContinuity, now: Date): WeekTransition {
  const emitted: WeekTransition["emitted"] = [];
  let next = { ...continuity };
  const time = now.getTime();

  if (next.state === "open" && time >= new Date(next.fridayRiskAt).getTime() && time < new Date(next.windowEndAt).getTime()) {
    next.state = "at_risk";
    emitted.push("week.at_risk");
  }
  if ((next.state === "open" || next.state === "at_risk") && time >= new Date(next.sundayLastChanceAt).getTime() && time < new Date(next.windowEndAt).getTime()) {
    emitted.push("week.last_chance");
  }
  if ((next.state === "open" || next.state === "at_risk") && time >= new Date(next.windowEndAt).getTime()) {
    if (next.freezesRemaining > 0) {
      next = { ...next, state: "frozen", freezesRemaining: next.freezesRemaining - 1 };
      emitted.push("week.frozen");
    } else {
      next = { ...next, state: "recovering", recoveryExpiresAt: new Date(new Date(next.windowEndAt).getTime() + 2 * DAY_MS).toISOString() };
      emitted.push("week.recovery_offered");
    }
  }
  if (next.state === "recovering" && next.recoveryExpiresAt && time >= new Date(next.recoveryExpiresAt).getTime()) {
    next = { ...next, state: "broken" };
    emitted.push("week.broken");
  }
  return { continuity: next, emitted: [...new Set(emitted)] };
}

export function recordQualifyingAction(continuity: WeekContinuity, occurredAt: Date): WeekTransition {
  const advanced = advanceWeek(continuity, occurredAt);
  const next = { ...advanced.continuity };
  const emitted = [...advanced.emitted];
  if (next.state === "completed" || next.state === "frozen" || next.state === "recovered" || next.state === "broken") {
    return { continuity: next, emitted };
  }
  if (next.state === "recovering") {
    if (next.recoveryExpiresAt && occurredAt.getTime() < new Date(next.recoveryExpiresAt).getTime()) {
      next.recoveryActionCount += 1;
      if (next.recoveryActionCount >= 2) {
        next.state = "recovered";
        next.streakLength += 1;
        emitted.push("week.recovered");
      }
    }
  } else {
    next.qualifyingActionCount += 1;
    next.state = "completed";
    next.streakLength += 1;
    emitted.push("week.completed");
  }
  return { continuity: next, emitted: [...new Set(emitted)] };
}
