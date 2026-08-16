import { describe, expect, it } from "vitest";
import { advanceWeek, createWeekContinuity, nextQuarterResetAt, recordQualifyingAction, weekWindowAt } from "./week";

describe("Destiny local Week continuity", () => {
  it("builds a Monday-to-Monday Pacific window across spring DST", () => {
    expect(weekWindowAt(new Date("2026-03-11T18:00:00Z"), "America/Los_Angeles")).toMatchObject({
      localWeekStart: "2026-03-09",
      windowStartAt: "2026-03-09T07:00:00.000Z",
      fridayRiskAt: "2026-03-13T19:00:00.000Z",
      windowEndAt: "2026-03-16T07:00:00.000Z",
    });
  });

  it("builds a Monday-to-Monday Eastern window across fall DST", () => {
    expect(weekWindowAt(new Date("2026-10-29T16:00:00Z"), "America/New_York")).toMatchObject({
      localWeekStart: "2026-10-26",
      windowStartAt: "2026-10-26T04:00:00.000Z",
      windowEndAt: "2026-11-02T05:00:00.000Z",
    });
  });

  it("marks Friday risk once and completes on the first useful action", () => {
    const open = createWeekContinuity(new Date("2026-08-10T16:00:00Z"), "America/Los_Angeles");
    const risk = advanceWeek(open, new Date("2026-08-14T20:00:00Z"));
    expect(risk.continuity.state).toBe("at_risk");
    expect(risk.emitted).toContain("week.at_risk");
    const completed = recordQualifyingAction(risk.continuity, new Date("2026-08-15T17:00:00Z"));
    expect(completed.continuity).toMatchObject({ state: "completed", qualifyingActionCount: 1, streakLength: 1 });
    expect(completed.emitted).toContain("week.completed");
  });

  it("automatically consumes one of two freezes at the local deadline", () => {
    const open = createWeekContinuity(new Date("2026-08-10T16:00:00Z"), "America/Los_Angeles");
    const closed = advanceWeek(open, new Date("2026-08-17T07:01:00Z"));
    expect(closed.continuity).toMatchObject({ state: "frozen", freezesRemaining: 1 });
    expect(closed.emitted).toContain("week.frozen");
  });

  it("offers recovery without a freeze and recovers after two actions", () => {
    const open = createWeekContinuity(new Date("2026-08-10T16:00:00Z"), "America/Los_Angeles", {
      streakLength: 4,
      freezesRemaining: 0,
      freezesResetAt: "2026-10-01T07:00:00.000Z",
    });
    const recovery = advanceWeek(open, new Date("2026-08-17T07:01:00Z"));
    expect(recovery.continuity.state).toBe("recovering");
    const first = recordQualifyingAction(recovery.continuity, new Date("2026-08-17T18:00:00Z"));
    expect(first.continuity).toMatchObject({ state: "recovering", recoveryActionCount: 1, streakLength: 4 });
    const second = recordQualifyingAction(first.continuity, new Date("2026-08-18T18:00:00Z"));
    expect(second.continuity).toMatchObject({ state: "recovered", recoveryActionCount: 2, streakLength: 5 });
    expect(second.emitted).toContain("week.recovered");
  });

  it("breaks the Week when the recovery window expires", () => {
    const open = createWeekContinuity(new Date("2026-08-10T16:00:00Z"), "UTC", {
      streakLength: 2,
      freezesRemaining: 0,
      freezesResetAt: "2026-10-01T00:00:00.000Z",
    });
    const recovery = advanceWeek(open, new Date("2026-08-17T00:01:00Z"));
    const expired = advanceWeek(recovery.continuity, new Date("2026-08-19T00:01:00Z"));
    expect(expired.continuity.state).toBe("broken");
    expect(expired.emitted).toContain("week.broken");
  });

  it("resets freezes at the next local calendar quarter", () => {
    expect(nextQuarterResetAt(new Date("2026-08-15T17:00:00Z"), "America/Los_Angeles")).toBe("2026-10-01T07:00:00.000Z");
  });

  it("rejects invalid IANA zones", () => {
    expect(() => weekWindowAt(new Date(), "Mars/Olympus")).toThrow("Invalid IANA time zone");
  });
});
