import { describe, expect, it } from "vitest";
import { buildWeeklySchedule, canScheduleArticle, publishingItemKey, stateForMissedSchedule, validatePublishingPlan, wordpressScheduleDate } from "./publishing-plan";

describe("publishing plans", () => {
  it("requires a deliberate mode and explicit automatic confirmation", () => {
    expect(() => validatePublishingPlan({ mode: "automatic", startDate: "2026-08-25", timezone: "America/Los_Angeles", postCount: 12 })).toThrow(/confirm/i);
    expect(validatePublishingPlan({ mode: "automatic", startDate: "2026-08-25", timezone: "America/Los_Angeles", postCount: 12, automaticConfirmed: true })).toMatchObject({ mode: "automatic" });
  });

  it("builds one deterministic weekly slot for each plan week", () => {
    const dates = buildWeeklySchedule("2026-08-25", 12);
    expect(dates).toHaveLength(12);
    expect(dates[0]).toBe("2026-08-25T16:00:00.000Z");
    expect(dates[11]).toBe("2026-11-10T16:00:00.000Z");
  });

  it("blocks scheduling until generation, quality, connection, and holdback checks pass", () => {
    expect(canScheduleArticle({ generated: false, qualityIssues: 0, connected: true, scheduledFor: "2026-08-25T16:00:00.000Z", now: "2026-08-16T16:00:00.000Z" }).reason).toMatch(/generate/i);
    expect(canScheduleArticle({ generated: true, qualityIssues: 1, connected: true, scheduledFor: "2026-08-25T16:00:00.000Z", now: "2026-08-16T16:00:00.000Z" }).reason).toMatch(/review/i);
    expect(canScheduleArticle({ generated: true, qualityIssues: 0, connected: false, scheduledFor: "2026-08-25T16:00:00.000Z", now: "2026-08-16T16:00:00.000Z" }).reason).toMatch(/WordPress/i);
    expect(canScheduleArticle({ generated: true, qualityIssues: 0, connected: true, scheduledFor: "2026-08-18T16:00:00.000Z", now: "2026-08-16T16:00:00.000Z" }).reason).toMatch(/72 hours/i);
    expect(canScheduleArticle({ generated: true, qualityIssues: 0, connected: true, scheduledFor: "2026-08-25T16:00:00.000Z", now: "2026-08-16T16:00:00.000Z" }).allowed).toBe(true);
  });

  it("creates stable idempotency keys and never silently publishes a missed slot late", () => {
    expect(publishingItemKey("plan-1", "  College   Counselor Pricing ")).toBe("plan-1:1:college counselor pricing");
    expect(stateForMissedSchedule("2026-08-15T16:00:00.000Z", "2026-08-16T16:00:00.000Z")).toBe("needs_review");
    expect(wordpressScheduleDate("2026-08-25T16:00:00.000Z", "2026-08-16T16:00:00.000Z")).toBe("2026-08-25T16:00:00");
  });

  it("keeps one article identity per plan slot even when a focus keyword repeats", () => {
    expect(publishingItemKey("plan-1", "background check compliance", 1)).not.toBe(
      publishingItemKey("plan-1", "background check compliance", 4),
    );
  });
});
