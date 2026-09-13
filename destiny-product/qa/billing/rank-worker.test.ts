import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@supabase/server", () => ({ withSupabase: (_options: unknown, handler: unknown) => handler }));
const access = vi.hoisted(() => vi.fn());
vi.mock("../../supabase/functions/_shared/billing/rank-access.ts", () => ({ rankTrackingAccess: access }));
beforeEach(() => { access.mockReset().mockResolvedValue(null); });
import worker from "../../supabase/functions/rank-tracker-refresh/index";
it("does not call the rank provider or create a run for an unpaid website", async () => {
  vi.stubGlobal("Deno", { env: { get: () => "fixture" } });
  const provider = vi.fn(); vi.stubGlobal("fetch", provider);
  const from = vi.fn(() => { throw new Error("Unexpected write"); });
  const rpc = vi.fn(async (name: string) => {
    expect(name).toBe("billing_rank_candidates");
    return { data: [{ id: "keyword-a", website_id: "site-a", keyword: "seo", websites: { normalized_domain: "example.com" } }], error: null };
  });
  try {
    const response = await worker.fetch(new Request("https://example.invalid", { method: "POST", headers: { "x-rank-tracker-secret": "fixture" } }), { supabaseAdmin: { from, rpc } } as never);
    expect(response.status).toBe(200);
    expect((await response.json()).runs).toMatchObject([{ status: "billing_paused", completed: 0 }]);
    expect(provider).not.toHaveBeenCalled(); expect(from).not.toHaveBeenCalled(); expect(rpc).toHaveBeenCalledTimes(1);
  } finally { vi.unstubAllGlobals(); }
});


it.each([false, true])("settles reserved checks and never spends when run creation fails (%s)", async (runFails) => {
  access.mockResolvedValue({ ownerId: "owner", limit: 25, trial: false });
  vi.stubGlobal("Deno", { env: { get: () => "fixture" } });
  const target = { id: "keyword-a", website_id: "site-a", keyword: "seo", search_depth: 200, websites: { normalized_domain: "example.com" } };
  const rpc = vi.fn(async (name: string, _args?: unknown) => {
    if (name === "billing_rank_candidates") return { data: [target, { ...target, id: "keyword-b" }], error: null };
    if (name === "reserve_rank_check") return { data: { allowed: true, id: `usage-${rpc.mock.calls.length}`, nextCheckAt: "2026-10-01T00:00:00Z" }, error: null };
    return { data: true, error: null };
  });
  const insert = vi.fn();
  const from = vi.fn((table: string) => ({
    insert: (payload: unknown) => {
      insert(table, payload);
      return table === "rank_tracker_runs"
        ? { select: () => ({ single: async () => ({ data: runFails ? null : { id: "run" }, error: runFails ? { message: "Unavailable" } : null }) }) }
        : Promise.resolve({ error: null });
    },
    update: () => ({ eq: async () => ({ error: null }) }),
  }));
  const provider = vi.fn(async () => Response.json({ tasks: [{ id: "task", status_code: 20000, cost: 0.012, result: [{ items: [{ type: "organic", domain: "example.com", rank_group: 3 }] }] }] }));
  vi.stubGlobal("fetch", provider);
  try {
    const response = await worker.fetch(new Request("https://example.invalid", { method: "POST", headers: { "x-rank-tracker-secret": "fixture" } }), { supabaseAdmin: { from, rpc } } as never);
    expect(response.status).toBe(runFails ? 503 : 200);
    expect(provider).toHaveBeenCalledTimes(runFails ? 0 : 2);
    const settlements = rpc.mock.calls.filter(([name]) => name === "finish_billing_usage");
    expect(settlements).toHaveLength(2);
    if (!runFails) {
      expect(await response.json()).toMatchObject({ processed: 2, runs: [{ completed: 2, totalCost: 0.024 }] });
      for (const call of provider.mock.calls as unknown as [string, RequestInit][]) expect(JSON.parse(String(call[1].body))[0].depth).toBe(100);
      expect(settlements[0][1]).toMatchObject({ p_succeeded: true, p_provider_cost_usd: 0.012 });
    } else expect(settlements[0][1]).toMatchObject({ p_succeeded: false, p_provider_cost_usd: 0 });
  } finally { vi.unstubAllGlobals(); }
});
