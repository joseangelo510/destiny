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

describe("POST /api/integrations/cms/wordpress/reconcile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getClaims.mockResolvedValue({ data: { claims: null } });
  });

  it("returns 401 before reconciling WordPress for an anonymous request", async () => {
    const response = await POST(new Request("http://localhost/api/integrations/cms/wordpress/reconcile", {
      method: "POST",
      body: JSON.stringify({ websiteId: "website-1", articleKey: "article-1" }),
    }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Sign in again to continue." });
    expect(invoke).not.toHaveBeenCalled();
  });
});
