import { beforeEach, describe, expect, it, vi } from "vitest";

const { getClaims, invokeFunction, maybeSingle } = vi.hoisted(() => ({
  getClaims: vi.fn(),
  invokeFunction: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  scopedClient: async () => ({
    getClaims,
    invokeFunction,
    website: () => ({ maybeSingle }),
  }),
}));

import { POST } from "./route";

const websiteId = "22222222-2222-4222-8222-222222222222";
const requestId = "11111111-1111-4111-8111-111111111111";

describe("POST /api/progress/report", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getClaims.mockResolvedValue("user-1");
    maybeSingle.mockResolvedValue({ data: { id: websiteId }, error: null });
    invokeFunction.mockResolvedValue({ data: { status: "accepted", messageId: "resend-123" }, error: null });
  });

  it("ignores a client-supplied recipient and invokes the authenticated function with only site and request ids", async () => {
    const response = await POST(new Request("http://localhost/api/progress/report", {
      method: "POST",
      body: JSON.stringify({ websiteId, requestId, recipient: "attacker@example.com" }),
    }));

    expect(response.status).toBe(202);
    expect(invokeFunction).toHaveBeenCalledWith("progress-report", { websiteId, requestId });
    await expect(response.json()).resolves.toEqual({ status: "accepted", messageId: "resend-123" });
  });

  it("rejects an inaccessible website before invoking the provider boundary", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    const response = await POST(new Request("http://localhost/api/progress/report", {
      method: "POST",
      body: JSON.stringify({ websiteId, requestId }),
    }));

    expect(response.status).toBe(403);
    expect(invokeFunction).not.toHaveBeenCalled();
  });

  it("requires authentication before invoking the provider boundary", async () => {
    getClaims.mockResolvedValue(null);
    const response = await POST(new Request("http://localhost/api/progress/report", {
      method: "POST",
      body: JSON.stringify({ websiteId, requestId }),
    }));

    expect(response.status).toBe(401);
    expect(invokeFunction).not.toHaveBeenCalled();
  });

  it("keeps provider rejection as an error and never reports acceptance", async () => {
    invokeFunction.mockResolvedValue({ data: { status: "failed", reason: "Provider rejected the request." }, error: null });
    const response = await POST(new Request("http://localhost/api/progress/report", {
      method: "POST",
      body: JSON.stringify({ websiteId, requestId }),
    }));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: "Provider rejected the request." });
  });
});
