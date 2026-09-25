import { expect, it, vi } from "vitest";
vi.mock("@supabase/server", () => ({ withSupabase: (_options: unknown, handler: unknown) => handler }));
import worker from "../../supabase/functions/suggest-competitors/index";
it("derives suggestion billing from verified identity and denies calls beyond the allowance", async () => {
  vi.stubGlobal("Deno", { env: { get: (name: string) => name === "BILLING_MODE" ? "test" : "fixture" } });
  const provider = vi.fn(); vi.stubGlobal("fetch", provider);
  const rpc = vi.fn(async () => ({ data: { allowed: false, reason: "payment_required" }, error: null }));
  const getUserById = vi.fn(async () => ({ data: { user: { email_confirmed_at: "2026-09-24T00:00:00Z" } }, error: null }));
  try {
    const response = await worker.fetch(new Request("https://example.invalid", { method: "POST", body: JSON.stringify({ website: "example.com", ownerId: "victim" }) }), { userClaims: { id: "owner-a" }, supabaseAdmin: { rpc, auth: { admin: { getUserById } } } } as never);
    expect(response.status).toBe(402);
    expect(rpc).toHaveBeenCalledWith("reserve_competitor_suggestions_v2", { p_owner_id: "owner-a", p_livemode: false, p_owner_verified: true });
    expect(provider).not.toHaveBeenCalled();
  } finally { vi.unstubAllGlobals(); }
});
it.each([20000, 40000])("records returned provider cost even when the task status is %s", async (status) => {
  vi.stubGlobal("Deno", { env: { get: (name: string) => name === "BILLING_MODE" ? "test" : "fixture" } });
  const provider = vi.fn(async () => Response.json({ status_code: 20000, tasks: [{ status_code: status, cost: 0.012, result: [{ items: [{ domain: "competitor.com", intersections: 42 }] }] }] }));
  vi.stubGlobal("fetch", provider);
  const rpc = vi.fn(async (name: string) => ({ data: name === "reserve_competitor_suggestions_v2" ? { allowed: true, id: "usage-a" } : true, error: null }));
  const getUserById = vi.fn(async () => ({ data: { user: { email_confirmed_at: "2026-09-24T00:00:00Z" } }, error: null }));
  try {
    const response = await worker.fetch(new Request("https://example.invalid", { method: "POST", body: JSON.stringify({ website: "example.com" }) }), { userClaims: { id: "owner-a" }, supabaseAdmin: { rpc, auth: { admin: { getUserById } } } } as never);
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("finish_billing_usage", { p_id: "usage-a", p_succeeded: status === 20000, p_provider_cost_usd: 0.012 });
    expect(provider).toHaveBeenCalledTimes(1);
    expect((await response.json()).suggestions).toHaveLength(status === 20000 ? 1 : 0);
  } finally { vi.unstubAllGlobals(); }
});

it.each([
  { result: { data: { user: { email_confirmed_at: null } }, error: null }, status: 403 },
  { result: { data: { user: null }, error: { message: "Auth unavailable" } }, status: 503 },
])("does not reserve or call the provider when owner verification cannot be established", async ({ result, status }) => {
  vi.stubGlobal("Deno", { env: { get: (name: string) => name === "BILLING_MODE" ? "test" : "fixture" } });
  const provider = vi.fn(); vi.stubGlobal("fetch", provider);
  const rpc = vi.fn();
  const getUserById = vi.fn(async () => result);
  try {
    const response = await worker.fetch(new Request("https://example.invalid", { method: "POST", body: JSON.stringify({ website: "example.com" }) }), { userClaims: { id: "owner-a" }, supabaseAdmin: { rpc, auth: { admin: { getUserById } } } } as never);
    expect(response.status).toBe(status);
    expect(rpc).not.toHaveBeenCalled();
    expect(provider).not.toHaveBeenCalled();
  } finally { vi.unstubAllGlobals(); }
});
