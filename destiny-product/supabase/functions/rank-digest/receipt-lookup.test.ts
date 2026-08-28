import { describe, expect, it, vi } from "vitest";
import { reconcileRankDigestProviderReceipt } from "./reconciliation";

const send = {
  id: "send-a",
  websiteId: "website-a",
  status: "accepted" as const,
  isTest: false,
};

function store() {
  return {
    updateSend: vi.fn().mockResolvedValue(undefined),
    updatePreference: vi.fn().mockResolvedValue(undefined),
    updateAttempt: vi.fn().mockResolvedValue(undefined),
    logFailure: vi.fn(),
  };
}

describe("rank digest provider receipt lookup", () => {
  it("records a non-OK lookup and advances the checked timestamp", async () => {
    const checkedAt = "2026-08-27T21:15:00.000Z";
    const persistence = store();
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      message: "This API key is restricted to only send emails.",
    }), { status: 401, headers: { "Content-Type": "application/json" } }));

    const result = await reconcileRankDigestProviderReceipt(send, {
      apiKey: "secret-not-for-logs",
      messageId: "message-a",
      checkedAt,
      fetcher,
    }, persistence);

    expect(result.ok).toBe(false);
    expect(persistence.updateAttempt).toHaveBeenCalledWith("send-a", {
      last_checked_at: checkedAt,
    });
    expect(persistence.logFailure).toHaveBeenCalledOnce();
    expect(persistence.updateSend).not.toHaveBeenCalled();
    expect(persistence.updatePreference).not.toHaveBeenCalled();
  });

  it("records a timeout and advances the checked timestamp", async () => {
    const checkedAt = "2026-08-27T21:16:00.000Z";
    const persistence = store();
    const fetcher = vi.fn().mockRejectedValue(new DOMException("Timed out", "TimeoutError"));

    const result = await reconcileRankDigestProviderReceipt(send, {
      apiKey: "secret-not-for-logs",
      messageId: "message-b",
      checkedAt,
      fetcher,
    }, persistence);

    expect(result.ok).toBe(false);
    expect(persistence.updateAttempt).toHaveBeenCalledWith("send-a", {
      last_checked_at: checkedAt,
    });
    expect(persistence.logFailure).toHaveBeenCalledWith(expect.objectContaining({
      errorClass: "timeout",
      httpStatus: null,
      messageId: "message-b",
    }));
  });

  it("includes the provider HTTP status in observable failure evidence", async () => {
    const persistence = store();
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      message: "Service unavailable.",
    }), { status: 503, headers: { "Content-Type": "application/json" } }));

    await reconcileRankDigestProviderReceipt(send, {
      apiKey: "secret-not-for-logs",
      messageId: "message-c",
      checkedAt: "2026-08-27T21:17:00.000Z",
      fetcher,
    }, persistence);

    expect(persistence.logFailure).toHaveBeenCalledWith({
      checkedAt: "2026-08-27T21:17:00.000Z",
      errorClass: "http_error",
      httpStatus: 503,
      message: "Service unavailable.",
      messageId: "message-c",
    });
  });

  it("keeps the existing success-path reconciliation behavior", async () => {
    const persistence = store();
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      last_event: "delivered",
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const result = await reconcileRankDigestProviderReceipt(send, {
      apiKey: "secret-not-for-logs",
      messageId: "message-d",
      checkedAt: "2026-08-27T21:18:00.000Z",
      fetcher,
    }, persistence);

    expect(result).toMatchObject({ ok: true, receipt: { status: "delivered" } });
    expect(persistence.updateSend).toHaveBeenCalledWith("send-a", expect.objectContaining({
      delivered_at: "2026-08-27T21:18:00.000Z",
      last_checked_at: "2026-08-27T21:18:00.000Z",
      provider_event: "delivered",
    }));
    expect(persistence.updateAttempt).not.toHaveBeenCalled();
    expect(persistence.logFailure).not.toHaveBeenCalled();
  });
});
