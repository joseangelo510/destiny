import { expect, it, vi } from "vitest";
vi.mock("@supabase/server", () => ({ withSupabase: (_options: unknown, handler: unknown) => handler }));
vi.mock("../../supabase/functions/_shared/billing/rank-access.ts", () => ({ rankTrackingAccess: async () => null }));
import worker from "../../supabase/functions/rank-tracker-refresh/index";
it("does not call the rank provider or create a run for an unpaid website", async () => {
  vi.stubGlobal("Deno", { env: { get: () => "fixture" } });
  const provider = vi.fn(); vi.stubGlobal("fetch", provider);
  const from = vi.fn((table: string) => {
    if (table !== "tracked_keywords") throw new Error("Unexpected write");
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "in", "lte", "order"]) builder[method] = () => builder;
    builder.limit = async () => ({ data: [{ id: "keyword-a", website_id: "site-a", keyword: "seo", websites: { normalized_domain: "example.com" } }], error: null });
    return builder;
  });
  try {
    const response = await worker.fetch(new Request("https://example.invalid", { method: "POST", headers: { "x-rank-tracker-secret": "fixture" } }), { supabaseAdmin: { from } } as never);
    expect(response.status).toBe(200);
    expect((await response.json()).runs).toMatchObject([{ status: "billing_paused", completed: 0 }]);
    expect(provider).not.toHaveBeenCalled(); expect(from).toHaveBeenCalledTimes(1);
  } finally { vi.unstubAllGlobals(); }
});
