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
