import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, getClaims } = vi.hoisted(() => ({
  createClient: vi.fn(),
  getClaims: vi.fn(),
}));

vi.mock("../../../lib/supabase/server", () => ({ createClient }));

import { GET, PATCH } from "./route";

describe("/api/notifications authentication contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClient.mockResolvedValue({ auth: { getClaims } });
    getClaims.mockResolvedValue({ data: { claims: null } });
  });

  it.each([
    ["GET", (request: Request) => GET(request)],
    ["PATCH", (request: Request) => PATCH(request)],
  ])("returns 401 for unauthenticated %s requests", async (_method, handler) => {
    const response = await handler(new Request("http://localhost/api/notifications?site=website-1", {
      method: _method,
      body: _method === "PATCH" ? JSON.stringify({ all: true }) : undefined,
    }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Sign in again to continue." });
  });
});
