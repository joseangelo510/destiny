import type { CommsCadence, NotificationEventType } from "./contracts";
import type { WeekContinuity } from "./week";

export function continuityMessagesDue({ continuity, now, alreadyEmitted, cadence }: { continuity: WeekContinuity; now: Date; alreadyEmitted: NotificationEventType[]; cadence: CommsCadence }) {
  if (cadence === "muted" || cadence === "essential") return [] as NotificationEventType[];
  if (continuity.state === "completed" || continuity.state === "frozen" || continuity.state === "recovered" || continuity.state === "broken") return [] as NotificationEventType[];
  const due: NotificationEventType[] = [];
  const timestamp = now.getTime();
  if (timestamp >= new Date(continuity.fridayRiskAt).getTime() && !alreadyEmitted.includes("week.at_risk")) due.push("week.at_risk");
  if (timestamp >= new Date(continuity.sundayLastChanceAt).getTime() && !alreadyEmitted.includes("week.last_chance")) due.push("week.last_chance");
  const priorContinuityCount = alreadyEmitted.filter((type) => type === "week.at_risk" || type === "week.last_chance").length;
  return due.slice(0, Math.max(0, 2 - priorContinuityCount));
}

export function isLocalMorningSendWindow(now: Date, timeZone: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now).map((part) => [part.type, part.value]));
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  return minutes >= 7 * 60 + 15 && minutes <= 8 * 60 + 15;
}
