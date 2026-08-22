import { beforeEach, describe, expect, it, vi } from "vitest";

const { getClaims, invoke } = vi.hoisted(() => ({
  getClaims: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getClaims },
    functions: { invoke },
  }),
}));

import { POST } from "./route";

describe("POST /api/integrations/cms/wordpress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getClaims.mockResolvedValue({ data: { claims: null } });
    invoke.mockResolvedValue({ data: null, error: new Error("must not be reached") });
  });

  it("returns 401 before invoking WordPress when the handler receives an anonymous request", async () => {
    const response = await POST(new Request("http://localhost/api/integrations/cms/wordpress", {
      method: "POST",
      body: JSON.stringify({
        websiteId: "website-1",
        siteUrl: "https://example.com",
        username: "owner",
        applicationPassword: "abcd efgh ijkl mnop",
      }),
    }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Sign in again to continue." });
    expect(invoke).not.toHaveBeenCalled();
  });
});
