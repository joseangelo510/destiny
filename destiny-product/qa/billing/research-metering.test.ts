import { expect, it, vi } from "vitest";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn(async () => ({ data: { allowed: false, reason: "limit_reached" }, error: null })) }));
vi.mock("@supabase/server", () => ({ withSupabase: (_options: unknown, handler: unknown) => handler }));
import research from "../../supabase/functions/seo-research/index";
it("blocks direct keyword and domain research before spending provider credits", async () => {
  vi.stubGlobal("Deno", { env: { get: () => "fixture_not_a_real_credential" } });
  const provider = vi.fn(); vi.stubGlobal("fetch", provider);
  try {
    for (const kind of ["keywords", "keyword_serp", "domain_overview", "backlinks"]) {
      const response = await research.fetch(new Request("https://example.invalid/research", { method: "POST", body: JSON.stringify({ kind, query: "seo", mode: "keyword", keyword: "seo", target: "example.com", market: "us" }) }), { userClaims: { id: "owner-a" }, supabaseAdmin: { rpc } } as never);
      expect(response.status).toBe(402);
    }
    expect(provider).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledTimes(4);
  } finally { vi.unstubAllGlobals(); }
});
it("rejects direct article-evidence requests without the server signature", async () => {
  vi.stubGlobal("Deno", { env: { get: () => "fixture_not_a_real_credential" } });
  const provider = vi.fn(); vi.stubGlobal("fetch", provider);
  try {
    const response = await research.fetch(new Request("https://example.invalid/research", { method: "POST", body: JSON.stringify({ kind: "article_evidence", keyword: "seo", billingUsageId: "forged" }) }), { userClaims: { id: "owner-a" }, supabaseAdmin: { rpc } } as never);
    expect(response.status).toBe(403); expect(provider).not.toHaveBeenCalled();
  } finally { vi.unstubAllGlobals(); }
});
it("charges creator discovery for all five platform searches and blocks exhausted accounts", async () => {
  rpc.mockClear();
  vi.stubGlobal("Deno", { env: { get: () => "fixture_not_a_real_credential" } });
  const provider = vi.fn(); vi.stubGlobal("fetch", provider);
  try {
    const response = await research.fetch(new Request("https://example.invalid/research", { method: "POST", body: JSON.stringify({ kind: "creators", topics: ["seo"] }) }), { userClaims: { id: "owner-a" }, supabaseAdmin: { rpc } } as never);
    expect(response.status).toBe(402);
    expect(rpc.mock.calls[0]).toMatchObject(["reserve_billing_usage", { p_meter: "keywordSearches", p_units: 5 }]);
    expect(provider).not.toHaveBeenCalled();
  } finally { vi.unstubAllGlobals(); }
});
