import { describe, expect, it } from "vitest";
import { auditTimingEstimate } from "./audit-timing";

describe("auditTimingEstimate", () => {
  it("uses the conservative 30-second production benchmark and saved progress", () => {
    expect(auditTimingEstimate({ progress: 10, status: "running" })).toMatchObject({ secondsRemaining: 30, delayed: false });
    expect(auditTimingEstimate({ progress: 45, status: "running" })).toMatchObject({ secondsRemaining: 20, delayed: false });
    expect(auditTimingEstimate({ progress: 80, status: "running" })).toMatchObject({ secondsRemaining: 10, delayed: false });
  });

  it("never promises zero while work is still running", () => {
    expect(auditTimingEstimate({ progress: 99, status: "running" }).secondsRemaining).toBe(5);
    expect(auditTimingEstimate({ progress: 100, status: "complete" }).secondsRemaining).toBe(0);
  });

  it("reports a truthful delay when the audit exceeds the observed normal range", () => {
    const now = Date.parse("2026-08-03T01:01:00.000Z");
    expect(auditTimingEstimate({
      progress: 65,
      status: "running",
      startedAt: "2026-08-03T01:00:00.000Z",
      nowMs: now,
    })).toMatchObject({ secondsRemaining: null, delayed: true });
  });
});
