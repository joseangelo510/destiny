import { describe, expect, it } from "vitest";
import {
  rankMovement,
  rankMovementFromReadings,
  rankReadingState,
  summarizeRankings,
  trackerFreshness,
} from "./rank-tracker";

describe("rank tracker evidence rules", () => {
  it("never presents a pending keyword as rank zero", () => {
    expect(rankReadingState({ status: "pending", position: null, found: null })).toEqual({
      label: "First check pending",
      tone: "pending",
    });
  });

  it("labels a completed top-100 miss truthfully", () => {
    expect(rankReadingState({ status: "active", position: null, found: false })).toEqual({
      label: "Not found in top 100",
      tone: "not-found",
    });
  });

  it("calculates improvement only from two confirmed ranks", () => {
    expect(rankMovement(7, 13)).toEqual({ delta: 6, label: "Up 6", tone: "up" });
    expect(rankMovement(18, 4)).toEqual({ delta: -14, label: "Down 14", tone: "down" });
    expect(rankMovement(9, null)).toEqual({ delta: null, label: "New", tone: "new" });
    expect(rankMovement(null, 9)).toEqual({ delta: null, label: "Lost", tone: "lost" });
  });

  it("names top-100 entry and exit without inventing a numeric delta", () => {
    expect(rankMovementFromReadings({ position: 8, found: true }, { position: null, found: false }).label).toBe("Entered top 100");
    expect(rankMovementFromReadings({ position: null, found: false }, { position: 8, found: true }).label).toBe("Dropped out");
  });

  it("keeps pending keywords out of ranking averages", () => {
    expect(summarizeRankings([
      { status: "active", position: 3, found: true },
      { status: "active", position: 12, found: true },
      { status: "active", position: null, found: false },
      { status: "pending", position: null, found: null },
    ])).toEqual({ tracked: 4, measured: 3, top3: 1, top10: 1, top20: 2, averagePosition: 8 });
  });

  it("explains fresh, due, and delayed first checks", () => {
    const now = new Date("2026-08-03T17:00:00.000Z");
    expect(trackerFreshness({ status: "active", lastCheckedAt: "2026-08-02T17:00:00.000Z", createdAt: "2026-07-20T17:00:00.000Z" }, now).state).toBe("fresh");
    expect(trackerFreshness({ status: "active", lastCheckedAt: "2026-07-20T17:00:00.000Z", createdAt: "2026-07-20T17:00:00.000Z" }, now).state).toBe("due");
    expect(trackerFreshness({ status: "pending", lastCheckedAt: null, createdAt: "2026-08-03T16:00:00.000Z" }, now).message).toContain("usually arrives within minutes");
    expect(trackerFreshness({ status: "pending", lastCheckedAt: null, createdAt: "2026-08-02T16:00:00.000Z" }, now).state).toBe("delayed");
  });
});
