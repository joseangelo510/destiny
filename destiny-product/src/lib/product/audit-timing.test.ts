import { describe, expect, it } from "vitest";
import { auditTimingEstimate } from "./audit-timing";

describe("auditTimingEstimate", () => {
  it("uses the conservative 30-second production benchmark and saved progress", async () => {
    await expect(auditTimingEstimate({ progress: 10, status: "running" })).resolves.toMatchObject({ secondsRemaining: 30, delayed: false });
    await expect(auditTimingEstimate({ progress: 45, status: "running" })).resolves.toMatchObject({ secondsRemaining: 20, delayed: false });
    await expect(auditTimingEstimate({ progress: 80, status: "running" })).resolves.toMatchObject({ secondsRemaining: 10, delayed: false });
  });

  it("never promises zero while work is still running", async () => {
    expect((await auditTimingEstimate({ progress: 99, status: "running" })).secondsRemaining).toBe(5);
    expect((await auditTimingEstimate({ progress: 100, status: "complete" })).secondsRemaining).toBe(0);
  });

  it("reports a truthful delay when the audit exceeds the observed normal range", async () => {
    const now = Date.parse("2026-08-03T01:01:00.000Z");
    await expect(auditTimingEstimate({
      progress: 65,
      status: "running",
      startedAt: "2026-08-03T01:00:00.000Z",
      nowMs: now,
    })).resolves.toMatchObject({ secondsRemaining: null, delayed: true });
  });

  it("keeps the 45-second boundary normal, delays at 46, and clamps clock skew", async () => {
    const startedAt = "2026-08-03T01:00:00.000Z";
    await expect(auditTimingEstimate({ progress: 65, status: "running", startedAt, nowMs: Date.parse("2026-08-03T01:00:45.000Z") })).resolves.toMatchObject({ delayed: false, secondsRemaining: 15 });
    await expect(auditTimingEstimate({ progress: 65, status: "running", startedAt, nowMs: Date.parse("2026-08-03T01:00:46.000Z") })).resolves.toMatchObject({ delayed: true, secondsRemaining: null });
    await expect(auditTimingEstimate({ progress: 30, status: "running", startedAt, nowMs: Date.parse("2026-08-03T00:59:00.000Z") })).resolves.toMatchObject({ delayed: false, secondsRemaining: 25 });
    await expect(auditTimingEstimate({ progress: 46, status: "failed" })).resolves.toMatchObject({ delayed: false, secondsRemaining: null });
  });
});
