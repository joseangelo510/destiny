import { afterEach, expect, it, vi } from "vitest";
import { signWorkerRequest } from "../../supabase/functions/_shared/billing/worker-auth";
vi.mock("@supabase/server", () => ({ withSupabase: (_options: unknown, handler: unknown) => handler }));
import usage from "../../supabase/functions/billing-usage/index";
import research from "../../supabase/functions/seo-research/index";
const secret = "fixture_only_member_012345678901234567890123456789";
const websiteId = "00000000-0000-4000-8000-000000000001";
function context(visible = true, receiptSite = websiteId, meter = "infographics") {
  const rpc = vi.fn(async (name: string) => ({ data: name === "claim_billing_stage" ? true : { allowed: true, id: "receipt" }, error: null }));
  const from = vi.fn(() => {
    const filters: Record<string, unknown> = {};
    const row: Record<string, unknown> = { id: "receipt", owner_id: "owner-a", website_id: receiptSite, meter };
    const chain = { select: () => chain, eq: (key: string, value: unknown) => { filters[key] = value; return chain; }, maybeSingle: async () => ({ data: Object.entries(filters).every(([key, value]) => row[key] === value) ? row : null, error: null }) };
    return chain;
  });
  return { userClaims: { id: "member-b" }, supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: visible ? { organizations: { owner_id: "owner-a" } } : null, error: null }) }) }) }) }, supabaseAdmin: { rpc, from } };
}
async function signed(body: Record<string, unknown>, endpoint: "billing-usage" | "seo-research" = "billing-usage") {
  vi.stubGlobal("Deno", { env: { get: (name: string) => name === "BILLING_WORKER_SECRET" ? secret : undefined } });
  const raw = JSON.stringify(body);
  return new Request("https://example.invalid", { method: "POST", body: raw, headers: await signWorkerRequest(raw, endpoint, secret) });
}
afterEach(() => vi.unstubAllGlobals());
it("charges the visible website owner rather than the member or supplied owner", async () => {
  const ctx = context();
  const response = await usage.fetch(await signed({ action: "reserve", websiteId, ownerId: "forged", meter: "articles", requestKey: "member-article" }), ctx as never);
  expect(response.status).toBe(200);
  expect(ctx.supabaseAdmin.rpc).toHaveBeenCalledWith("reserve_billing_usage", expect.objectContaining({ p_owner_id: "owner-a", p_website_id: websiteId }));
});
it("denies inaccessible or revoked website access before any private usage operation", async () => {
  const ctx = context(false);
  for (const action of ["reserve", "finish", "bind", "stage"]) {
    const response = await usage.fetch(await signed({ action, websiteId, id: "receipt", meter: "articles", requestKey: "member-article", succeeded: true, hash: "a".repeat(64) }), ctx as never);
    expect(response.status).toBe(403);
  }
  expect(ctx.supabaseAdmin.rpc).not.toHaveBeenCalled();
  expect(ctx.supabaseAdmin.from).not.toHaveBeenCalled();
});
it("allows member settlement and artifact steps only for the selected website receipt", async () => {
  for (const action of ["finish", "bind", "stage"]) {
    const body = { action, websiteId, id: "receipt", succeeded: true, hash: "a".repeat(64) };
    const ctx = context();
    expect((await usage.fetch(await signed(body), ctx as never)).status).toBe(200);
    expect(ctx.supabaseAdmin.rpc).toHaveBeenCalled();
    const wrongSite = context(true, "another-site");
    expect((await usage.fetch(await signed(body), wrongSite as never)).status).toBe(403);
    expect(wrongSite.supabaseAdmin.rpc).not.toHaveBeenCalled();
  }
});
it("requires explicit website scope on server-signed settlement", async () => {
  const ctx = context();
  expect((await usage.fetch(await signed({ action: "finish", id: "receipt", succeeded: false }), ctx as never)).status).toBe(400);
  expect(ctx.supabaseAdmin.rpc).not.toHaveBeenCalled();
});
it("scopes article evidence to the owner's matching website receipt before provider access", async () => {
  const ctx = context();
  const provider = vi.fn(); vi.stubGlobal("fetch", provider);
  const response = await research.fetch(await signed({ kind: "article_evidence", websiteId, billingUsageId: "receipt", keyword: "seo" }, "seo-research"), ctx as never);
  // This fixture is an infographic receipt and cannot authorize article evidence.
  expect(response.status).toBe(403);
  expect(ctx.supabaseAdmin.rpc).not.toHaveBeenCalled();
  expect(provider).not.toHaveBeenCalled();
});

it("claims a member article evidence stage against the site owner, without an extra allowance", async () => {
  const ctx = context(true, websiteId, "articles");
  const response = await research.fetch(await signed({ kind: "article_evidence", websiteId, billingUsageId: "receipt", keyword: "seo" }, "seo-research"), ctx as never);
  expect(response.status).toBe(503); // No provider credentials in this fixture.
  expect(ctx.supabaseAdmin.rpc).toHaveBeenCalledExactlyOnceWith("claim_billing_stage", { p_owner_id: "owner-a", p_id: "receipt", p_stage: "article_evidence", p_artifact_hash: null });
});
