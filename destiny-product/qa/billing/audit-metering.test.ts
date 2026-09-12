import { expect, it, vi } from "vitest";
vi.mock("@supabase/server", () => ({ withSupabase: (_options: unknown, handler: unknown) => handler }));
const research = vi.hoisted(() => vi.fn());
vi.mock("../../supabase/functions/process-audit/seo.ts", () => ({ runSeoAudit: research }));
import worker from "../../supabase/functions/process-audit/index";

it.each(["limit_reached", "payment_required", "verification_required"])("never starts audit research when billing returns %s", async (reason) => {
  vi.stubGlobal("Deno", { env: { get: (name: string) => name === "BILLING_MODE" ? "test" : "fixture" } });
  const waitUntil = vi.fn(); vi.stubGlobal("EdgeRuntime", { waitUntil });
  const rpc = vi.fn(async () => ({ data: { allowed: false, reason }, error: null }));
  const from = (table: string) => {
    const result = { data: table === "websites" ? { id: "site-a", url: "https://example.com" } : null, error: null };
    const builder = { select: () => builder, eq: () => builder, maybeSingle: async () => result, then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve) };
    return builder;
  };
  try {
    const response = await worker.fetch(new Request("https://example.invalid", { method: "POST", body: JSON.stringify({ websiteId: "site-a" }) }), { userClaims: { id: "owner-a" }, supabase: { from }, supabaseAdmin: { rpc } } as never);
    expect(response.status).toBe(reason === "verification_required" ? 403 : 402);
    expect(await response.json()).toMatchObject({ billingUrl: "/account/billing" });
    expect(rpc).toHaveBeenCalledWith("begin_billed_audit", { p_website_id: "site-a", p_user_id: "owner-a", p_provider: "dataforseo", p_livemode: false });
    expect(research).not.toHaveBeenCalled(); expect(waitUntil).not.toHaveBeenCalled();
  } finally { vi.unstubAllGlobals(); }
});

it("bounds competitor research and settles a failed background audit", async () => {
  vi.stubGlobal("Deno", { env: { get: (name: string) => name === "BILLING_MODE" ? "test" : "fixture" } });
  let background: Promise<unknown> | undefined;
  vi.stubGlobal("EdgeRuntime", { waitUntil: (task: Promise<unknown>) => { background = task; } });
  research.mockRejectedValueOnce(new Error("Provider unavailable"));
  const rpc = vi.fn(async (name: string) => ({ data: name === "begin_billed_audit" ? { allowed: true, created: true, auditId: "audit-a", usageId: "usage-a" } : true, error: null }));
  const from = (table: string) => {
    const result = { data: table === "websites" ? { id: "site-a", url: "https://example.com" } : table === "competitors" ? Array.from({ length: 20 }, (_, i) => ({ name: `Competitor ${i}` })) : null, error: null };
    const builder = { select: () => builder, eq: () => builder, maybeSingle: async () => result, then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve) };
    return builder;
  };
  try {
    const response = await worker.fetch(new Request("https://example.invalid", { method: "POST", body: JSON.stringify({ websiteId: "site-a" }) }), { userClaims: { id: "owner-a" }, supabase: { from }, supabaseAdmin: { rpc } } as never);
    expect(response.status).toBe(202);
    await background;
    expect(research.mock.calls.at(-1)?.[0].knownCompetitors).toHaveLength(5);
    expect(rpc).toHaveBeenCalledWith("finish_billing_usage", { p_id: "usage-a", p_succeeded: false, p_provider_cost_usd: null });
  } finally { vi.unstubAllGlobals(); research.mockReset(); }
});
