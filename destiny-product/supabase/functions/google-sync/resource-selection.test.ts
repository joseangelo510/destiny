import { describe, expect, it } from "vitest";
import { googleResourceRequest, googleSyncPersistence } from "./resource-selection";

describe("Google sync resource recovery", () => {
  it("distinguishes an explicit resource from a recoverable saved resource", () => {
    expect(googleResourceRequest("properties/new", "properties/saved")).toEqual({ resourceId: "properties/new", recoverSavedMismatch: false });
    expect(googleResourceRequest(undefined, " properties/saved ")).toEqual({ resourceId: "properties/saved", recoverSavedMismatch: true });
    expect(googleResourceRequest(undefined, null)).toEqual({ resourceId: null, recoverSavedMismatch: false });
  });

  it("does not mark property discovery as a completed data sync", () => {
    expect(googleSyncPersistence({
      externalAccountId: null,
      metadata: { selectionRequired: true, availableProperties: [{ property: "properties/222", matchesWebsite: true }] },
    }, "google_analytics", "2026-09-24T09:00:00.000Z")).toEqual({
      external_account_id: null,
      metadata: {
        selectionRequired: true,
        availableProperties: [{ property: "properties/222", matchesWebsite: true }],
        provider: "google_analytics",
      },
      status: "connected",
    });
  });

  it("records sync time only after a validated resource returned report data", () => {
    expect(googleSyncPersistence({ externalAccountId: "properties/222", metadata: { organicSessions: 12 } }, "google_analytics", "2026-09-24T09:00:00.000Z")).toMatchObject({
      external_account_id: "properties/222",
      last_synced_at: "2026-09-24T09:00:00.000Z",
      metadata: { organicSessions: 12, provider: "google_analytics", syncedAt: "2026-09-24T09:00:00.000Z" },
      status: "connected",
    });
  });
});
