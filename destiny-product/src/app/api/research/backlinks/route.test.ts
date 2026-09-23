import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getClaims: vi.fn(), invoke: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getClaims: mocks.getClaims }, functions: { invoke: mocks.invoke } }) }));
vi.mock("@/lib/billing/failure-response", () => ({ billingFailureResponse: async () => null }));
import { POST } from "./route";

const request = (target: unknown) => new Request("http://localhost/api/research/backlinks", {
  method: "POST", body: JSON.stringify({ target }),
});

describe("POST /api/research/backlinks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "owner-1" } } });
    mocks.invoke.mockResolvedValue({ data: { target: "clearcheck.app", rows: [] }, error: null });
  });

  it("requires authentication before accepting a domain", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: null } });
    expect((await POST(request("clearcheck.app"))).status).toBe(401);
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it.each(["not-a-domain", "localhost", "https://", " ", 12])("explains an invalid domain without reserving provider work: %j", async target => {
    const response = await POST(request(target));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Enter a valid public domain." });
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it("normalizes an ordinary public URL before invoking backlink research", async () => {
    const response = await POST(request("https://www.clearcheck.app/2026/09/example"));
    expect(response.status).toBe(200);
    expect(mocks.invoke).toHaveBeenCalledWith("seo-research", { body: { kind: "backlinks", target: "clearcheck.app" } });
  });
});
