import { beforeEach, describe, expect, it, vi } from "vitest";
const { getClaims, invoke, maybeSingle } = vi.hoisted(() => ({ getClaims: vi.fn(), invoke: vi.fn(), maybeSingle: vi.fn() }));
vi.mock("@/lib/db", () => ({ scopedClient: async () => ({ getClaims, invokeFunction: invoke, website: () => ({ maybeSingle }) }) }));
import { POST } from "./route";
const request = (body: unknown) => new Request("http://localhost/api/research/domain-overview", { method: "POST", body: JSON.stringify(body && typeof body === "object" ? {websiteId: "site-1", ...body} : body) });
describe("Domain Overview API boundary", () => {
  beforeEach(() => { vi.clearAllMocks(); getClaims.mockResolvedValue("user-1"); maybeSingle.mockResolvedValue({data:{id:"site-1"},error:null}); invoke.mockResolvedValue({ data: { target: "example.com", summary: {}, sections: {}, status: "partial" }, error: null }); });
  it("does not invoke the paid provider without authentication", async () => {
    getClaims.mockResolvedValue(null);
    expect((await POST(request({ target: "example.com", market: "US" }))).status).toBe(401);
    expect(invoke).not.toHaveBeenCalled();
  });
  it.each([{ target: "localhost", market: "US" }, { target: "example.com", market: "toString" }, { target: "example.com" }, null])("rejects invalid input before provider access: %j", async body => {
    expect((await POST(request(body))).status).toBe(400); expect(invoke).not.toHaveBeenCalled();
  });
  it("normalizes the requested domain and preserves a partial snapshot privately", async () => {
    const response = await POST(request({ target: "https://www.example.com/page", market: "DE" }));
    expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(invoke).toHaveBeenCalledWith("seo-research", { kind: "domain_overview", target: "example.com", market: "DE" });
    expect((await response.json()).status).toBe("partial");
  });
  it("rejects a workspace owned by another tenant", async () => {
    maybeSingle.mockResolvedValue({data:null,error:null});
    expect((await POST(request({target:"example.com",market:"US"}))).status).toBe(404);
    expect(invoke).not.toHaveBeenCalled();
  });
  it("keeps raw provider failures out of the browser", async () => {
    invoke.mockResolvedValue({ error: { message: "private provider details" } });
    const response = await POST(request({ target: "example.com", market: "US" }));
    expect(response.status).toBe(502); expect(await response.text()).not.toContain("private provider");
  });
});
