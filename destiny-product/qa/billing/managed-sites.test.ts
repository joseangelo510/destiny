import { afterEach, expect, it, vi } from "vitest";
vi.mock("@supabase/server", () => ({ withSupabase: (_options: unknown, handler: unknown) => handler }));
import billing from "../../supabase/functions/billing/index";
const id = "00000000-0000-4000-8000-000000000001";
const request = (body: unknown) => new Request("https://example.invalid", { method: "POST", body: JSON.stringify(body) });
afterEach(() => vi.unstubAllGlobals());
it("reads and saves only the verified owner's site selection without Stripe credentials", async () => {
  vi.stubGlobal("Deno", { env: { get: () => { throw new Error("No Stripe call required"); } } });
  const rpc = vi.fn(async () => ({ data: { capacity: 1, selected: [id], websites: [] }, error: null }));
  const context = { userClaims: { id: "owner-a" }, supabaseAdmin: { rpc } };
  expect((await billing.fetch(request({ action: "sites", ownerId: "forged" }), context as never)).status).toBe(200);
  expect(rpc).toHaveBeenCalledWith("billing_website_selection", { p_owner_id: "owner-a" });
  expect((await billing.fetch(request({ action: "select_sites", websiteIds: [id], ownerId: "forged" }), context as never)).status).toBe(200);
  expect(rpc).toHaveBeenCalledWith("set_billing_websites", { p_actor_id: "owner-a", p_website_ids: [id] });
});
it("rejects absent identity and invalid selections without a privileged call", async () => {
  const rpc = vi.fn();
  expect((await billing.fetch(request({ action: "sites" }), { userClaims: {}, supabaseAdmin: { rpc } } as never)).status).toBe(401);
  for (const websiteIds of [null, ["invalid"], [id, id], Array(11).fill(id)]) {
    expect((await billing.fetch(request({ action: "select_sites", websiteIds }), { userClaims: { id: "owner-a" }, supabaseAdmin: { rpc } } as never)).status).toBe(400);
  }
  expect(rpc).not.toHaveBeenCalled();
});
