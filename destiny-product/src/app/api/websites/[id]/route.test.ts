import { beforeEach, describe, expect, it, vi } from "vitest";

const websiteId = "11111111-1111-4111-8111-111111111111";
const secondWebsiteId = "22222222-2222-4222-8222-222222222222";

const { deleteQuery, state } = vi.hoisted(() => ({
  deleteQuery: vi.fn(),
  state: {
    authenticated: true,
    lookup: { data: { id: "11111111-1111-4111-8111-111111111111", business_name: "Example Co", normalized_domain: "example.com" }, error: null as { message: string } | null },
    deletion: { data: { id: "11111111-1111-4111-8111-111111111111" } as { id: string } | null, error: null as { message: string } | null },
    remaining: { data: [{ id: "22222222-2222-4222-8222-222222222222" }], error: null as { message: string } | null },
  },
}));

vi.mock("../../../../lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getClaims: async () => ({ data: { claims: state.authenticated ? { sub: "user-one" } : null } }) },
    from: () => ({
      select: (columns: string) => columns === "id,business_name,normalized_domain"
        ? { eq: () => ({ maybeSingle: async () => state.lookup }) }
        : { order: () => ({ limit: async () => state.remaining }) },
      delete: deleteQuery,
    }),
  }),
}));

import { DELETE } from "./route";

function request(confirmation: string, activeWebsiteId = websiteId) {
  return new Request(`http://localhost/api/websites/${websiteId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", Cookie: `destiny_active_website=${activeWebsiteId}` },
    body: JSON.stringify({ confirmation }),
  });
}

describe("DELETE /api/websites/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.authenticated = true;
    state.lookup = { data: { id: websiteId, business_name: "Example Co", normalized_domain: "example.com" }, error: null };
    state.deletion = { data: { id: websiteId }, error: null };
    state.remaining = { data: [{ id: secondWebsiteId }], error: null };
    deleteQuery.mockReturnValue({
      eq: () => ({
        eq: () => ({
          select: () => ({ maybeSingle: async () => state.deletion }),
        }),
      }),
    });
  });

  it("requires an authenticated user", async () => {
    state.authenticated = false;
    const response = await DELETE(request("example.com"), { params: Promise.resolve({ id: websiteId }) });
    expect(response.status).toBe(401);
    expect(deleteQuery).not.toHaveBeenCalled();
  });

  it("rejects an invalid website id", async () => {
    const response = await DELETE(request("example.com"), { params: Promise.resolve({ id: "not-a-website" }) });
    expect(response.status).toBe(400);
    expect(deleteQuery).not.toHaveBeenCalled();
  });

  it("requires the exact website domain before deleting", async () => {
    const response = await DELETE(request("wrong.example"), { params: Promise.resolve({ id: websiteId }) });
    expect(response.status).toBe(400);
    expect(deleteQuery).not.toHaveBeenCalled();
  });

  it("deletes only the requested website and selects a safe remaining website", async () => {
    const response = await DELETE(request(" EXAMPLE.COM "), { params: Promise.resolve({ id: websiteId }) });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ deleted: true, nextWebsiteId: secondWebsiteId });
    expect(deleteQuery).toHaveBeenCalledOnce();
    expect(response.headers.get("set-cookie")).toContain(`destiny_active_website=${secondWebsiteId}`);
  });

  it("preserves the active website when a different website is deleted", async () => {
    state.remaining = { data: [{ id: websiteId }, { id: secondWebsiteId }], error: null };
    state.lookup = { data: { id: secondWebsiteId, business_name: "Second Co", normalized_domain: "second.example" }, error: null };
    state.deletion = { data: { id: secondWebsiteId }, error: null };
    const response = await DELETE(request("second.example", websiteId), { params: Promise.resolve({ id: secondWebsiteId }) });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ deleted: true, nextWebsiteId: websiteId });
    expect(response.headers.get("set-cookie")).toContain(`destiny_active_website=${websiteId}`);
  });

  it("returns forbidden when row-level security denies deletion", async () => {
    state.deletion = { data: null, error: null };
    const response = await DELETE(request("example.com"), { params: Promise.resolve({ id: websiteId }) });
    expect(response.status).toBe(403);
  });

  it("clears the active website when the final website is deleted", async () => {
    state.remaining = { data: [], error: null };
    const response = await DELETE(request("example.com"), { params: Promise.resolve({ id: websiteId }) });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ deleted: true, nextWebsiteId: null });
    expect(response.headers.get("set-cookie")).toContain("destiny_active_website=");
    expect(response.headers.get("set-cookie")).toContain("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
  });
});
