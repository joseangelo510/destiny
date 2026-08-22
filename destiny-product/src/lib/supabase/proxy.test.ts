import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { getClaims } = vi.hoisted(() => ({ getClaims: vi.fn() }));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getClaims } }),
}));

import { updateSession } from "./proxy";
import { ACTIVE_WEBSITE_COOKIE } from "@/lib/workspace-selection";

function request(path: string, init?: RequestInit) {
  return new NextRequest(`https://destiny.example${path}`, init);
}

describe("updateSession authentication perimeter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getClaims.mockResolvedValue({ data: { claims: null } });
  });

  it("returns 401 JSON for an unauthenticated protected API request", async () => {
    const response = await updateSession(request("/api/audits", { method: "POST" }));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Sign in again to continue." });
  });

  it("redirects an unauthenticated page to login with a safe internal next path", async () => {
    const response = await updateSession(request("/keywords?site=not-a-uuid"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://destiny.example/login?next=%2Fkeywords%3Fsite%3Dnot-a-uuid");
  });

  it.each(["/", "/login", "/login/verify", "/auth", "/auth/callback"])("allows the public path %s", async (path) => {
    const response = await updateSession(request(path));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("keeps the interactive Google OAuth exception exact to GET and its path", async () => {
    const getResponse = await updateSession(request("/api/integrations/google/start?provider=youtube", { method: "GET" }));
    expect(getResponse.status).toBe(307);
    expect(getResponse.headers.get("location")).toContain("/login?next=");

    const postResponse = await updateSession(request("/api/integrations/google/start", { method: "POST" }));
    expect(postResponse.status).toBe(401);
  });

  it("persists a valid website selection only for an authenticated non-prefetch request", async () => {
    const websiteId = "11111111-1111-4111-8111-111111111111";
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });

    const response = await updateSession(request(`/keywords?site=${websiteId}`));
    expect(response.cookies.get(ACTIVE_WEBSITE_COOKIE)?.value).toBe(websiteId);

    const prefetchResponse = await updateSession(request(`/keywords?site=${websiteId}`, {
      headers: { purpose: "prefetch" },
    }));
    expect(prefetchResponse.cookies.get(ACTIVE_WEBSITE_COOKIE)).toBeUndefined();

    const invalidResponse = await updateSession(request("/keywords?site=not-a-uuid"));
    expect(invalidResponse.cookies.get(ACTIVE_WEBSITE_COOKIE)).toBeUndefined();
  });
});
