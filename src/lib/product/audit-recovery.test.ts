import { describe, expect, it } from "vitest";
import { auditHasStalled, recoverAbandonedAudit } from "./audit-recovery";

describe("audit recovery", () => {
  const nowMs = Date.parse("2026-08-04T22:22:00.000Z");

  it("marks a running audit abandoned after three minutes without a saved checkpoint", () => {
    expect(auditHasStalled({ nowMs, status: "running", updatedAt: "2026-08-04T22:19:00.000Z" })).toBe(true);
    expect(recoverAbandonedAudit({ status: "running", updated_at: "2026-08-04T22:19:00.000Z", failure_message: null }, nowMs)).toMatchObject({
      status: "failed",
      failure_message: expect.stringContaining("answers are safe"),
    });
  });

  it("does not interrupt an active or completed audit", () => {
    expect(auditHasStalled({ nowMs, status: "running", updatedAt: "2026-08-04T22:19:01.000Z" })).toBe(false);
    expect(auditHasStalled({ nowMs, status: "complete", updatedAt: "2026-08-04T21:00:00.000Z" })).toBe(false);
  });
});
