import { describe, expect, it } from "vitest";
import { calculateWeeklyStreak } from "./streak";

describe("calculateWeeklyStreak", () => {
  const now = new Date("2026-08-06T12:00:00Z");

  it("counts consecutive distinct weeks", () => {
    expect(calculateWeeklyStreak([
      "2026-08-05T10:00:00Z",
      "2026-08-04T10:00:00Z",
      "2026-07-29T10:00:00Z",
      "2026-07-22T10:00:00Z",
    ], now)).toBe(3);
  });

  it("allows the current week to remain unfinished", () => {
    expect(calculateWeeklyStreak(["2026-07-29T10:00:00Z", "2026-07-22T10:00:00Z"], now)).toBe(2);
  });

  it("returns zero for missing or stale completion weeks", () => {
    expect(calculateWeeklyStreak([null, "not-a-date", "2026-06-01T10:00:00Z"], now)).toBe(0);
  });
});
