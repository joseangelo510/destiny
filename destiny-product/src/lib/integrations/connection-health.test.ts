import { describe, expect, it } from "vitest";
import { connectionHealth } from "./connection-health";

describe("connectionHealth", () => {
  const now = new Date("2026-08-13T20:00:00Z");

  it("requires reconnection for revoked credentials", () => {
    expect(connectionHealth("revoked", null, now)).toMatchObject({ connected: false, needsAttention: true, label: "Reconnect needed" });
  });

  it("distinguishes a connected account that has not synced", () => {
    expect(connectionHealth("connected", null, now)).toMatchObject({ connected: true, needsAttention: true, label: "Ready to sync" });
  });

  it("flags stale data without claiming authorization failed", () => {
    expect(connectionHealth("connected", "2026-07-01T00:00:00Z", now)).toMatchObject({ connected: true, needsAttention: true, label: "Sync overdue" });
  });

  it("recognizes a recent successful sync", () => {
    expect(connectionHealth("connected", "2026-08-12T00:00:00Z", now)).toMatchObject({ connected: true, needsAttention: false, label: "Connected" });
  });
});
