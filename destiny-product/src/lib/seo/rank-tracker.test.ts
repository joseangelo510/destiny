import { describe, expect, it } from "vitest";
import {
  rankMovement,
  rankMovementFromReadings,
  rankReadingState,
  summarizeRankings,
  trackerFreshness,
} from "./rank-tracker";

describe("rank tracker evidence rules", () => {
  it("never presents a pending keyword as rank zero", async () => {
    await expect(rankReadingState({ status: "pending", position: null, found: null })).resolves.toEqual({
      label: "First check pending",
      tone: "pending",
    });
  });

  it("labels a completed top-100 miss truthfully", async () => {
    await expect(rankReadingState({ status: "active", position: null, found: false })).resolves.toEqual({
      label: "Not yet visible",
      tone: "not-found",
    });
  });

  it("calculates improvement only from two confirmed ranks", async () => {
    await expect(rankMovement(7, 13)).resolves.toEqual({ delta: 6, label: "Up 6", tone: "up" });
    await expect(rankMovement(18, 4)).resolves.toEqual({ delta: -14, label: "Down 14", tone: "down" });
    await expect(rankMovement(9, null)).resolves.toEqual({ delta: null, label: "New", tone: "new" });
    await expect(rankMovement(null, 9)).resolves.toEqual({ delta: null, label: "Not yet visible", tone: "lost" });
  });

  it("names top-100 entry and exit without inventing a numeric delta", async () => {
    expect((await rankMovementFromReadings({ position: 8, found: true }, { position: null, found: false })).label).toBe("Now visible");
    expect((await rankMovementFromReadings({ position: null, found: false }, { position: 8, found: true })).label).toBe("Not yet visible");
  });

  it("keeps pending keywords out of ranking averages", async () => {
    await expect(summarizeRankings([
      { status: "active", position: 3, found: true },
      { status: "active", position: 12, found: true },
      { status: "active", position: null, found: false },
      { status: "pending", position: null, found: null },
    ])).resolves.toEqual({ tracked: 4, measured: 3, top3: 1, top10: 1, top20: 2, averagePosition: 8 });
  });

  it("explains fresh, due, and delayed first checks", async () => {
    const now = new Date("2026-08-03T17:00:00.000Z");
    expect((await trackerFreshness({ status: "active", lastCheckedAt: "2026-08-02T17:00:00.000Z", createdAt: "2026-07-20T17:00:00.000Z" }, now)).state).toBe("fresh");
    expect((await trackerFreshness({ status: "active", lastCheckedAt: "2026-07-20T17:00:00.000Z", createdAt: "2026-07-20T17:00:00.000Z" }, now)).state).toBe("due");
    expect((await trackerFreshness({ status: "pending", lastCheckedAt: null, createdAt: "2026-08-03T16:00:00.000Z" }, now)).message).toContain("usually arrives within minutes");
    expect((await trackerFreshness({ status: "pending", lastCheckedAt: null, createdAt: "2026-08-02T16:00:00.000Z" }, now)).state).toBe("delayed");
  });
});
