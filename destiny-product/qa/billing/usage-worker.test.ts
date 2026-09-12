import { afterEach, expect, it, vi } from "vitest";
import { signWorkerRequest } from "../../supabase/functions/_shared/billing/worker-auth";
vi.mock("@supabase/server", () => ({ withSupabase: (_options: unknown, handler: unknown) => handler }));
import usage from "../../supabase/functions/billing-usage/index";
const secret = "fixture_only_012345678901234567890123456789";
afterEach(() => vi.unstubAllGlobals());
it("rejects a signed-in browser trying to refund its own usage", async () => {
  vi.stubGlobal("Deno", { env: { get: () => secret } });
  const rpc = vi.fn();
  const response = await usage.fetch(new Request("https://example.invalid", { method: "POST", body: JSON.stringify({ action: "finish", id: "usage-a", succeeded: false }) }), { userClaims: { id: "owner-a" }, supabaseAdmin: { rpc } } as never);
  expect(response.status).toBe(403); expect(rpc).not.toHaveBeenCalled();
});
it("uses the verified owner claim for a server-signed reservation", async () => {
  vi.stubGlobal("Deno", { env: { get: () => secret } });
  const body = JSON.stringify({ action: "reserve", ownerId: "forged", websiteId: "site-a", meter: "articles", requestKey: "article-request-1" });
  const headers = await signWorkerRequest(body, "billing-usage", secret);
  const rpc = vi.fn(async () => ({ data: { allowed: true, id: "usage-a" }, error: null }));
  const response = await usage.fetch(new Request("https://example.invalid", { method: "POST", body, headers }), { userClaims: { id: "owner-a" }, supabaseAdmin: { rpc } } as never);
  expect(response.status).toBe(200);
  expect(rpc.mock.calls[0]).toEqual(["reserve_billing_usage", { p_owner_id: "owner-a", p_website_id: "site-a", p_meter: "articles", p_request_key: "article-request-1", p_units: 1 }]);
});
