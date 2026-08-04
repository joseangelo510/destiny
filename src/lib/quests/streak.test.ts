import { describe, expect, it } from "vitest";
import { buildWeeklyProgressSummary, weeklyProgressPolicyInput } from "./streak";
import { REAL_USER_ZERO_HISTORY } from "./fixtures/real-user-zero-history";

describe("LOGOS weekly momentum", () => {
  const now = new Date("2026-08-06T12:00:00Z");
  const tasks = [
    { audit_id: "audit-a", week_number: 1, task_type: "primary_quest", status: "complete", completed_at: "2026-07-22T10:00:00Z", created_at: "2026-07-20T10:00:00Z" },
    { audit_id: "audit-a", week_number: 1, task_type: "content_review", status: "complete", completed_at: "2026-07-23T10:00:00Z", created_at: "2026-07-20T10:00:00Z" },
    { audit_id: "audit-b", week_number: 1, task_type: "primary_quest", status: "complete", completed_at: "2026-07-29T10:00:00Z", created_at: "2026-07-27T10:00:00Z" },
    { audit_id: "audit-b", week_number: 1, task_type: "content_review", status: "complete", completed_at: "2026-07-30T10:00:00Z", created_at: "2026-07-27T10:00:00Z" },
    { audit_id: "audit-c", week_number: 1, task_type: "primary_quest", status: "complete", completed_at: "2026-08-05T10:00:00Z", created_at: "2026-08-03T10:00:00Z" },
    { audit_id: "audit-c", week_number: 1, task_type: "content_review", status: "todo", completed_at: null, created_at: "2026-08-03T10:00:00Z" },
    { audit_id: "audit-c", week_number: 1, task_type: "business_confirmation", status: "todo", completed_at: null, created_at: "2026-08-03T10:00:00Z" },
  ];

  it("marshals Monday UTC week indexes and plan counts without calculating the streak", () => {
    expect(weeklyProgressPolicyInput(tasks, now)).toEqual({
      streakCurrentWeek: 2952,
      streakWeekIndexes: [2950, 2951, 2952],
      streakPlans: [{ total: 2, complete: 2 }, { total: 2, complete: 2 }, { total: 2, complete: 1 }],
    });
  });

  it("returns LOGOS-owned current, best, perfect, and lifetime momentum", async () => {
    await expect(buildWeeklyProgressSummary(tasks, now)).resolves.toEqual({ currentStreak: 3, bestStreak: 3, perfectWeeks: 2, lifetimeActiveWeeks: 3 });
  });

  it("allows the current week to remain unfinished and breaks on a missing prior week", async () => {
    const sparse = [
      { audit_id: "audit-a", week_number: 1, task_type: "primary_quest", status: "complete", completed_at: "2026-07-29T10:00:00Z", created_at: "2026-07-27T10:00:00Z" },
      { audit_id: "audit-b", week_number: 1, task_type: "primary_quest", status: "complete", completed_at: "2026-07-15T10:00:00Z", created_at: "2026-07-13T10:00:00Z" },
    ];
    await expect(buildWeeklyProgressSummary(sparse, now)).resolves.toMatchObject({ currentStreak: 1, bestStreak: 1, lifetimeActiveWeeks: 2 });
  });

  it("returns zero momentum for malformed or absent completion history", async () => {
    const malformed = [{ audit_id: null, week_number: 1, task_type: "primary_quest", status: "todo", completed_at: "not-a-date", created_at: "not-a-date" }];
    await expect(buildWeeklyProgressSummary(malformed, now)).resolves.toEqual({ currentStreak: 0, bestStreak: 0, perfectWeeks: 0, lifetimeActiveWeeks: 0 });
  });

  it("ignores a week containing only streak-excluded tasks", async () => {
    const excludedOnly = [
      { id: "confirm", audit_id: "audit-a", week_number: 1, task_type: "business_confirmation", status: "complete", completed_at: "2026-07-29T10:00:00Z", created_at: "2026-07-27T10:00:00Z" },
      { id: "vocab", audit_id: "audit-a", week_number: 1, task_type: "vocabulary_review", status: "complete", completed_at: "2026-07-30T10:00:00Z", created_at: "2026-07-27T10:00:00Z" },
    ];
    await expect(buildWeeklyProgressSummary(excludedOnly, now)).resolves.toEqual({ currentStreak: 0, bestStreak: 0, perfectWeeks: 0, lifetimeActiveWeeks: 0 });
  });

  it("deduplicates repeated persisted rows for the same task", async () => {
    const duplicate = { id: "task-1", audit_id: "audit-a", week_number: 1, task_type: "primary_quest", status: "complete", completed_at: "2026-08-05T10:00:00Z", created_at: "2026-08-03T10:00:00Z" };
    expect(weeklyProgressPolicyInput([duplicate, duplicate], now)).toMatchObject({
      streakWeekIndexes: [2952],
      streakPlans: [{ total: 1, complete: 1 }],
    });
    await expect(buildWeeklyProgressSummary([duplicate, duplicate], now)).resolves.toEqual({ currentStreak: 1, bestStreak: 1, perfectWeeks: 1, lifetimeActiveWeeks: 1 });
  });

  it("replays a sanitized real user-zero task history through LOGOS", async () => {
    await expect(buildWeeklyProgressSummary(REAL_USER_ZERO_HISTORY, new Date("2026-08-03T12:00:00Z"))).resolves.toEqual({
      currentStreak: 1,
      bestStreak: 1,
      perfectWeeks: 0,
      lifetimeActiveWeeks: 1,
    });
  });
});
