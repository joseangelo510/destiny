import { describe, expect, it, vi } from "vitest";
import { reconcileRankDigestSend } from "./reconciliation";

describe("rank digest receipt reconciliation", () => {
  it("updates only the send and website preference named by the provider receipt", async () => {
    const updateSend = vi.fn().mockResolvedValue(undefined);
    const updatePreference = vi.fn().mockResolvedValue(undefined);

    const receipt = await reconcileRankDigestSend({
      id: "send-a",
      websiteId: "website-a",
      status: "accepted",
      isTest: false,
    }, "delivered", "2026-08-22T06:50:00.000Z", { updateSend, updatePreference });

    expect(receipt.status).toBe("delivered");
    expect(updateSend).toHaveBeenCalledOnce();
    expect(updateSend).toHaveBeenCalledWith("send-a", expect.objectContaining({
      status: "delivered",
      delivered_at: "2026-08-22T06:50:00.000Z",
    }));
    expect(updatePreference).toHaveBeenCalledOnce();
    expect(updatePreference).toHaveBeenCalledWith("website-a", {
      last_digest_status: "delivered",
      last_digest_error: null,
      updated_at: "2026-08-22T06:50:00.000Z",
    });
  });

  it("records failure for the correct website without touching another tenant", async () => {
    const updatedWebsites: string[] = [];
    const updateSend = vi.fn().mockResolvedValue(undefined);
    const updatePreference = vi.fn(async (websiteId: string) => {
      updatedWebsites.push(websiteId);
    });

    const receipt = await reconcileRankDigestSend({
      id: "send-b",
      websiteId: "website-b",
      status: "accepted",
      isTest: false,
    }, "suppressed", "2026-08-22T06:51:00.000Z", { updateSend, updatePreference });

    expect(receipt.status).toBe("failed");
    expect(updatedWebsites).toEqual(["website-b"]);
    expect(updatedWebsites).not.toContain("website-a");
    expect(updateSend).toHaveBeenCalledWith("send-b", expect.objectContaining({
      error: "Email provider reported suppressed.",
    }));
  });

  it("never changes the normal website digest state for a test email", async () => {
    const updateSend = vi.fn().mockResolvedValue(undefined);
    const updatePreference = vi.fn().mockResolvedValue(undefined);

    await reconcileRankDigestSend({
      id: "test-send",
      websiteId: "website-a",
      status: "accepted",
      isTest: true,
    }, "delivered", "2026-08-22T06:52:00.000Z", { updateSend, updatePreference });

    expect(updateSend).toHaveBeenCalledOnce();
    expect(updatePreference).not.toHaveBeenCalled();
  });

  it("produces deterministic updates when the same provider event is replayed", async () => {
    const send = {
      id: "send-a",
      websiteId: "website-a",
      status: "accepted" as const,
      isTest: false,
    };
    const firstSendUpdates: unknown[] = [];
    const secondSendUpdates: unknown[] = [];

    const first = await reconcileRankDigestSend(send, "delivered", "2026-08-22T06:53:00.000Z", {
      updateSend: async (_id, update) => { firstSendUpdates.push(update); },
      updatePreference: async () => undefined,
    });
    const second = await reconcileRankDigestSend(send, "delivered", "2026-08-22T06:53:00.000Z", {
      updateSend: async (_id, update) => { secondSendUpdates.push(update); },
      updatePreference: async () => undefined,
    });

    expect(second).toEqual(first);
    expect(secondSendUpdates).toEqual(firstSendUpdates);
  });
});
