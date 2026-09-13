import { expect, it, vi } from "vitest";
vi.mock("@supabase/server", () => ({ withSupabase: (_options: unknown, handler: unknown) => handler }));
const access = vi.hoisted(() => vi.fn(async () => null));
vi.mock("../../supabase/functions/_shared/billing/website-access.ts", () => ({ websitePaidAccess: access }));
import worker from "../../supabase/functions/rank-digest/index";
it.each([false, true])("does not create or send a new unpaid/unmanaged digest, including forced tests=%s", async forced => {
  vi.stubGlobal("Deno", { env: { get: (name: string) => name === "DESTINY_FROM_EMAIL" ? "Rebound SEO <hello@reboundseo.com>" : "fixture" } });
  const provider = vi.fn(); vi.stubGlobal("fetch", provider);
  const rpc = vi.fn(async (name: string) => {
    expect(name).toBe("billing_digest_candidates");
    return { data: [{ website_id: "site-a", websites: { normalized_domain: "example.com" } }], error: null };
  });
  const from = vi.fn((table: string) => {
    expect(table).toBe("rank_digest_sends");
    const query = { select: () => query, in: () => query, not: () => query, order: () => query, limit: async () => ({ data: [] }) };
    return query;
  });
  try {
    const response = await worker.fetch(new Request("https://example.invalid", { method: "POST", headers: { "x-rank-tracker-secret": "fixture" }, body: JSON.stringify({ force: forced, isTest: forced }) }), { supabaseAdmin: { from, rpc } } as never);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ results: [{ websiteId: "site-a", status: "billing_paused" }] });
    expect(provider).not.toHaveBeenCalled();
    expect(from).toHaveBeenCalledTimes(1);
  } finally { vi.unstubAllGlobals(); }
});
