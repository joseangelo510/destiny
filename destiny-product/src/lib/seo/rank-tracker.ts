export type RankReading = {
  status: string;
  position: number | null;
  found: boolean | null;
};

export type TrackedRankRow = RankReading & {
  createdAt: string;
  lastCheckedAt: string | null;
};

export function normalizeTrackedKeyword(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

const baseInput = { auditComplete: 0, criticalIssues: 0, warnings: 0, rankingKeywords: 0, newKeywords: 0, lostKeywords: 0, contentGaps: 0, reviewCount: 0 };

export function rankPolicyInput(reading: RankReading, previous: { position: number | null; found: boolean | null } | null = null, timing?: { createdAt: string; lastCheckedAt: string | null; now: Date }): DestinyLogicInput {
  const ageHours = timing ? Math.max(0, Math.floor((timing.now.getTime() - new Date(timing.createdAt).getTime()) / 3_600_000)) : 0;
  const ageDays = timing?.lastCheckedAt ? Math.max(0, Math.floor((timing.now.getTime() - new Date(timing.lastCheckedAt).getTime()) / 86_400_000)) : 0;
  return { ...baseInput,
    rankStatusCode: reading.status === "error" ? 2 : reading.status === "pending" ? 0 : 1,
    rankFoundCode: reading.found === null ? -1 : Number(reading.found), rankCurrentPosition: reading.position ?? 0,
    rankHasPrevious: Number(previous !== null), rankPreviousFound: Number(previous?.found === true), rankPreviousPosition: previous?.position ?? 0,
    rankHasLastCheck: Number(Boolean(timing?.lastCheckedAt)), rankAgeHours: ageHours, rankAgeDays: ageDays,
  };
}

export function rankReadingFromPolicy(policy: Pick<DestinyLogicResult, "rankReadingCode">, position: number | null) {
  const states = [
    { label: "Check failed — retrying", tone: "error" as const },
    { label: "First check pending", tone: "pending" as const },
    { label: "Not yet visible", tone: "not-found" as const },
    { label: `#${position}`, tone: "ranked" as const },
  ];
  return states[policy.rankReadingCode] ?? states[0];
}

export function rankMovementFromPolicy(policy: Pick<DestinyLogicResult, "rankMovementCode" | "rankMovementDelta">) {
  const delta = policy.rankMovementDelta;
  const states = [
    { delta: null, label: "—", tone: "flat" as const }, { delta: null, label: "New", tone: "new" as const },
    { delta: null, label: "Now visible", tone: "new" as const }, { delta: null, label: "Not yet visible", tone: "lost" as const },
    { delta, label: `Up ${delta}`, tone: "up" as const }, { delta, label: `Down ${Math.abs(delta)}`, tone: "down" as const },
    { delta: 0, label: "No change", tone: "flat" as const },
  ];
  return states[policy.rankMovementCode] ?? states[0];
}

export function rankFreshnessFromPolicy(policy: Pick<DestinyLogicResult, "rankFreshnessCode">, ageDays: number) {
  const states = [
    { state: "pending" as const, message: "Your first Google reading usually arrives within minutes. Please allow up to 24 hours." },
    { state: "delayed" as const, message: "The first check is taking longer than expected. Destiny will retry automatically." },
    { state: "due" as const, message: "A new weekly reading is due." },
    { state: "fresh" as const, message: `Checked ${ageDays === 0 ? "today" : `${ageDays} day${ageDays === 1 ? "" : "s"} ago`}.` },
  ];
  return states[policy.rankFreshnessCode] ?? { state: "delayed" as const, message: "Rank freshness is unavailable. Reload to try again." };
}

export async function rankTrackerView(reading: RankReading, previous: { position: number | null; found: boolean | null } | null = null, timing?: { createdAt: string; lastCheckedAt: string | null; now: Date }) {
  const input = rankPolicyInput(reading, previous, timing);
  const policy = await runDestinyServerLogic(input);
  return { reading: rankReadingFromPolicy(policy, reading.position), movement: rankMovementFromPolicy(policy), freshness: rankFreshnessFromPolicy(policy, input.rankAgeDays ?? 0), bucket: policy.rankBucket };
}

export async function rankReadingState(reading: RankReading) { return (await rankTrackerView(reading)).reading; }
export async function rankMovementFromReadings(current: { position: number | null; found: boolean | null }, previous: { position: number | null; found: boolean | null } | null) { return (await rankTrackerView({ status: "active", ...current }, previous)).movement; }
export async function rankMovement(current: number | null, previous: number | null) { return rankMovementFromReadings({ position: current, found: current !== null }, previous === null ? null : { position: previous, found: true }); }

export async function summarizeRankings(readings: RankReading[]) {
  const completed = readings.filter((reading) => reading.status !== "pending" && reading.found !== null);
  const positions = completed.flatMap((reading) => reading.found && reading.position !== null ? [reading.position] : []);
  const policies = await Promise.all(completed.map((reading) => runDestinyServerLogic(rankPolicyInput(reading))));
  return {
    tracked: readings.length,
    measured: completed.length,
    top3: policies.filter((policy) => policy.rankBucket === 1).length,
    top10: policies.filter((policy) => policy.rankBucket === 1 || policy.rankBucket === 2).length,
    top20: policies.filter((policy) => policy.rankBucket > 0 && policy.rankBucket < 4).length,
    averagePosition: positions.length ? Math.round(positions.reduce((sum, position) => sum + position, 0) / positions.length) : null,
  };
}

export async function trackerFreshness(row: Pick<TrackedRankRow, "status" | "createdAt" | "lastCheckedAt">, now = new Date()) {
  return (await rankTrackerView({ status: row.status, position: null, found: row.status === "pending" ? null : false }, null, { ...row, now })).freshness;
}
import type { DestinyLogicInput, DestinyLogicResult } from "../logicaffeine";
import { runDestinyServerLogic } from "../logicaffeine-server";
