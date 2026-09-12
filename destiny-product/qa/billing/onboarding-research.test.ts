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
