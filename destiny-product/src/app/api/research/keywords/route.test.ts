import { beforeEach, describe, expect, it, vi } from "vitest";
const { getClaims, invoke } = vi.hoisted(() => ({ getClaims: vi.fn(), invoke: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getClaims }, functions: { invoke } }) }));
import { POST } from "./route";
const request = (version?: unknown) => new Request("http://localhost/api/research/keywords", { method: "POST", body: JSON.stringify({ query: "test keyword", mode: "keyword", metricContractVersion: version }) });
describe("keyword metric contract forwarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getClaims.mockResolvedValue({ data: { claims: { sub: "fixture-user" } } });
    invoke.mockResolvedValue({ data: { rows: [{ volume: null }] }, error: null });
  });
  it("forwards explicit v2 and preserves nullable Edge data", async () => {
    const response = await POST(request(2));
    expect(invoke).toHaveBeenCalledWith("seo-research", { body: expect.objectContaining({ metricContractVersion: 2 }) });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({ rows: [{ volume: null }] });
  });
  it.each([undefined, "2", 3])("keeps an old or unsupported client on the legacy contract (%s)", async version => {
    expect((await POST(request(version))).status).toBe(200);
    expect(invoke.mock.calls[0][1].body).not.toHaveProperty("metricContractVersion");
  });
  it("preserves the existing signed-out denial", async () => {
    getClaims.mockResolvedValueOnce({ data: { claims: null } });
    expect((await POST(request(2))).status).toBe(401);
    expect(invoke).not.toHaveBeenCalled();
  });
});
