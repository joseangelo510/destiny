import { expect, it, vi } from "vitest";
vi.mock("@supabase/server", () => ({ withSupabase: (_options: unknown, handler: unknown) => handler }));
import worker from "../../supabase/functions/suggest-competitors/index";
it("derives suggestion billing from verified identity and denies calls beyond the allowance", async () => {
  vi.stubGlobal("Deno", { env: { get: (name: string) => name === "BILLING_MODE" ? "test" : "fixture" } });
  const provider = vi.fn(); vi.stubGlobal("fetch", provider);
  const rpc = vi.fn(async () => ({ data: { allowed: false, reason: "payment_required" }, error: null }));
  try {
    const response = await worker.fetch(new Request("https://example.invalid", { method: "POST", body: JSON.stringify({ website: "example.com", ownerId: "victim" }) }), { userClaims: { id: "owner-a" }, supabaseAdmin: { rpc } } as never);
    expect(response.status).toBe(402);
    expect(rpc).toHaveBeenCalledWith("reserve_competitor_suggestions", { p_owner_id: "owner-a", p_livemode: false });
    expect(provider).not.toHaveBeenCalled();
  } finally { vi.unstubAllGlobals(); }
});
it.each([20000, 40000])("records returned provider cost even when the task status is %s", async (status) => {
  vi.stubGlobal("Deno", { env: { get: (name: string) => name === "BILLING_MODE" ? "test" : "fixture" } });
  const provider = vi.fn(async () => Response.json({ status_code: 20000, tasks: [{ status_code: status, cost: 0.012, result: [{ items: [{ domain: "competitor.com", intersections: 42 }] }] }] }));
  vi.stubGlobal("fetch", provider);
  const rpc = vi.fn(async (name: string) => ({ data: name === "reserve_competitor_suggestions" ? { allowed: true, id: "usage-a" } : true, error: null }));
  try {
    const response = await worker.fetch(new Request("https://example.invalid", { method: "POST", body: JSON.stringify({ website: "example.com" }) }), { userClaims: { id: "owner-a" }, supabaseAdmin: { rpc } } as never);
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("finish_billing_usage", { p_id: "usage-a", p_succeeded: status === 20000, p_provider_cost_usd: 0.012 });
    expect(provider).toHaveBeenCalledTimes(1);
    expect((await response.json()).suggestions).toHaveLength(status === 20000 ? 1 : 0);
  } finally { vi.unstubAllGlobals(); }
});
