import { describe, expect, it } from "vitest";
import { buildWeeklyProgressSummary, calculateWeeklyStreak } from "./streak";

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

  it("separates active weeks, current and best streaks, and perfect plans", () => {
    const tasks = [
      { audit_id: "audit-a", week_number: 1, task_type: "primary_quest", status: "complete", completed_at: "2026-07-22T10:00:00Z", created_at: "2026-07-20T10:00:00Z" },
      { audit_id: "audit-a", week_number: 1, task_type: "content_review", status: "complete", completed_at: "2026-07-23T10:00:00Z", created_at: "2026-07-20T10:00:00Z" },
      { audit_id: "audit-b", week_number: 1, task_type: "primary_quest", status: "complete", completed_at: "2026-07-29T10:00:00Z", created_at: "2026-07-27T10:00:00Z" },
      { audit_id: "audit-b", week_number: 1, task_type: "content_review", status: "complete", completed_at: "2026-07-30T10:00:00Z", created_at: "2026-07-27T10:00:00Z" },
      { audit_id: "audit-c", week_number: 1, task_type: "primary_quest", status: "complete", completed_at: "2026-08-05T10:00:00Z", created_at: "2026-08-03T10:00:00Z" },
      { audit_id: "audit-c", week_number: 1, task_type: "content_review", status: "todo", completed_at: null, created_at: "2026-08-03T10:00:00Z" },
      { audit_id: "audit-c", week_number: 1, task_type: "business_confirmation", status: "todo", completed_at: null, created_at: "2026-08-03T10:00:00Z" },
    ];

    expect(buildWeeklyProgressSummary(tasks, now)).toEqual({
      currentStreak: 3,
      bestStreak: 3,
      perfectWeeks: 2,
      lifetimeActiveWeeks: 3,
    });
  });
});
