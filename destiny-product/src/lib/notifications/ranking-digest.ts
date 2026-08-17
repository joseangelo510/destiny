export type RankingDigestFrequency = "three_day" | "weekly" | "off";
export type RankingDigestSendStatus = "never" | "sent" | "failed" | "skipped";

export const RANKING_DIGEST_FREQUENCIES: RankingDigestFrequency[] = ["three_day", "weekly", "off"];
export const RECOMMENDED_RANKING_DIGEST_FREQUENCY: RankingDigestFrequency = "three_day";
export const DEFAULT_RANKING_DIGEST_FREQUENCY: RankingDigestFrequency = "weekly";

export function isRankingDigestFrequency(value: unknown): value is RankingDigestFrequency {
  return typeof value === "string" && (RANKING_DIGEST_FREQUENCIES as string[]).includes(value);
}

export function rankingDigestFrequencyLabel(frequency: RankingDigestFrequency) {
  if (frequency === "three_day") return "Every 3 days";
  if (frequency === "weekly") return "Weekly";
  return "Off";
}

export type RankingEmailPreferenceState = {
  frequency: RankingDigestFrequency;
  unsubscribedAt: string | null;
};

/** Unsubscribing always wins over any stored cadence. */
export function effectiveRankingDigestFrequency(preference: RankingEmailPreferenceState | null): RankingDigestFrequency {
  if (!preference) return DEFAULT_RANKING_DIGEST_FREQUENCY;
  if (preference.unsubscribedAt) return "off";
  return preference.frequency;
}

/** Plain-language cadence line for the Rank tracker page. */
export function rankingEmailCadenceSummary(preference: RankingEmailPreferenceState | null) {
  const frequency = effectiveRankingDigestFrequency(preference);
  if (frequency === "three_day") return "Ranking email updates arrive every 3 days.";
  if (frequency === "weekly") return "Ranking email updates arrive weekly.";
  return "Ranking email updates are off.";
}

export function lastRankingDigestSummary({ lastStatus, lastSentAt }: { lastStatus: RankingDigestSendStatus; lastSentAt: string | null }) {
  const day = lastSentAt ? new Date(lastSentAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }) : null;
  if (lastStatus === "sent" && day) return `Last sent ${day}`;
  if (lastStatus === "failed") return day ? `Last attempt failed ${day}` : "Last attempt failed";
  if (lastStatus === "skipped") return day ? `Last run skipped ${day}` : "Last run skipped";
  return "No ranking email sent yet";
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Next scheduled send for a cadence, from a reference instant. Off never schedules. */
export function computeNextDigestAt(frequency: RankingDigestFrequency, fromIso: string): string | null {
  if (frequency === "off") return null;
  const from = new Date(fromIso).getTime();
  if (!Number.isFinite(from)) return null;
  return new Date(from + (frequency === "three_day" ? 3 : 7) * DAY_MS).toISOString();
}

/** Idempotency key for one send window: same website + period key never sends twice. */
export function rankingDigestPeriodKey(frequency: RankingDigestFrequency, sendAtIso: string) {
  return `${frequency}:${sendAtIso.slice(0, 10)}`;
}

/** A reading only counts toward a digest when it was observed inside the current period. */
export function isFreshReading(observedAtIso: string | null, periodStartIso: string) {
  if (!observedAtIso) return false;
  const observed = new Date(observedAtIso).getTime();
  const start = new Date(periodStartIso).getTime();
  return Number.isFinite(observed) && Number.isFinite(start) && observed >= start;
}

export type RankingDigestEntry = {
  keyword: string;
  currentPosition: number | null;
  currentFound: boolean;
  previousPosition: number | null;
  previousFound: boolean | null;
};

export type RankingDigestMover = { keyword: string; from: number | null; to: number | null; delta: number };

export type RankingDigestSummary = {
  keywordsCompared: number;
  movedUp: number;
  movedDown: number;
  steady: number;
  baselines: string[];
  enteredTop10: number;
  leftTop10: number;
  topMovers: RankingDigestMover[];
};

const inTop10 = (position: number | null, found: boolean | null) => Boolean(found) && position !== null && position <= 10;

/**
 * Movement math for the digest. First readings (no previous observation) are
 * baselines: they use baseline language and never count as movement.
 */
export function summarizeRankingMovements(entries: RankingDigestEntry[], topMoverLimit = 3): RankingDigestSummary {
  let movedUp = 0, movedDown = 0, steady = 0, enteredTop10 = 0, leftTop10 = 0;
  const baselines: string[] = [];
  const movers: RankingDigestMover[] = [];
  for (const entry of entries) {
    const isBaseline = entry.previousFound === null;
    if (isBaseline) {
      baselines.push(entry.keyword);
      continue;
    }
    const current = entry.currentFound ? entry.currentPosition : null;
    const previous = entry.previousFound ? entry.previousPosition : null;
    if (inTop10(current, entry.currentFound) && !inTop10(previous, entry.previousFound)) enteredTop10 += 1;
    if (!inTop10(current, entry.currentFound) && inTop10(previous, entry.previousFound)) leftTop10 += 1;
    if (current === null && previous === null) { steady += 1; continue; }
    // Appearing from unranked counts as up; disappearing counts as down.
    const delta = (previous ?? 101) - (current ?? 101);
    if (delta > 0) movedUp += 1;
    else if (delta < 0) movedDown += 1;
    else steady += 1;
    if (delta !== 0) movers.push({ keyword: entry.keyword, from: previous, to: current, delta });
  }
  movers.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return {
    keywordsCompared: entries.length - baselines.length,
    movedUp, movedDown, steady, baselines, enteredTop10, leftTop10,
    topMovers: movers.slice(0, topMoverLimit),
  };
}

/** Baseline language for keywords measured for the first time. */
export function baselineLanguage(keyword: string) {
  return `${keyword}: first reading recorded — this becomes your baseline for future comparisons.`;
}
