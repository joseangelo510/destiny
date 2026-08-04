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

export function rankReadingState(reading: RankReading) {
  if (reading.status === "error") return { label: "Check failed — retrying", tone: "error" as const };
  if (reading.status === "pending" || reading.found === null) {
    return { label: "First check pending", tone: "pending" as const };
  }
  if (reading.found === false || reading.position === null) {
    return { label: "Not found in top 100", tone: "not-found" as const };
  }
  return { label: `#${reading.position}`, tone: "ranked" as const };
}

export function rankMovementFromReadings(current: { position: number | null; found: boolean | null }, previous: { position: number | null; found: boolean | null } | null) {
  if (!previous) return current.found ? { delta: null, label: "New", tone: "new" as const } : { delta: null, label: "—", tone: "flat" as const };
  if (current.found && current.position !== null && previous.found === false) return { delta: null, label: "Entered top 100", tone: "new" as const };
  if (current.found === false && previous.found && previous.position !== null) return { delta: null, label: "Dropped out", tone: "lost" as const };
  return rankMovement(current.position, previous.position);
}

export function rankMovement(current: number | null, previous: number | null) {
  if (current === null && previous === null) return { delta: null, label: "—", tone: "flat" as const };
  if (current !== null && previous === null) return { delta: null, label: "New", tone: "new" as const };
  if (current === null) return { delta: null, label: "Lost", tone: "lost" as const };
  const delta = (previous as number) - current;
  if (delta > 0) return { delta, label: `Up ${delta}`, tone: "up" as const };
  if (delta < 0) return { delta, label: `Down ${Math.abs(delta)}`, tone: "down" as const };
  return { delta: 0, label: "No change", tone: "flat" as const };
}

export function summarizeRankings(readings: RankReading[]) {
  const completed = readings.filter((reading) => reading.status !== "pending" && reading.found !== null);
  const positions = completed.flatMap((reading) => reading.found && reading.position !== null ? [reading.position] : []);
  return {
    tracked: readings.length,
    measured: completed.length,
    top3: positions.filter((position) => position <= 3).length,
    top10: positions.filter((position) => position <= 10).length,
    top20: positions.filter((position) => position <= 20).length,
    averagePosition: positions.length ? Math.round(positions.reduce((sum, position) => sum + position, 0) / positions.length) : null,
  };
}

export function trackerFreshness(row: Pick<TrackedRankRow, "status" | "createdAt" | "lastCheckedAt">, now = new Date()) {
  if (!row.lastCheckedAt) {
    const ageHours = (now.getTime() - new Date(row.createdAt).getTime()) / 3_600_000;
    if (ageHours > 24) return { state: "delayed" as const, message: "The first check is taking longer than expected. Destiny will retry automatically." };
    return { state: "pending" as const, message: "Your first Google reading usually arrives within minutes. Please allow up to 24 hours." };
  }
  const ageDays = (now.getTime() - new Date(row.lastCheckedAt).getTime()) / 86_400_000;
  if (ageDays >= 7) return { state: "due" as const, message: "A new weekly reading is due." };
  return { state: "fresh" as const, message: `Checked ${Math.max(0, Math.floor(ageDays)) === 0 ? "today" : `${Math.floor(ageDays)} day${Math.floor(ageDays) === 1 ? "" : "s"} ago`}.` };
}
