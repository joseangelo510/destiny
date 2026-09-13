import { afterEach, expect, it, vi } from "vitest";
const { access } = vi.hoisted(() => ({ access: vi.fn() }));
vi.mock("@supabase/server", () => ({ withSupabase: (_options: unknown, handler: unknown) => handler }));
vi.mock("../../supabase/functions/_shared/billing/website-access.ts", () => ({ websitePaidAccess: access }));
import billing from "../../supabase/functions/billing/index";
const websiteId = "00000000-0000-4000-8000-000000000001";
const request = () => new Request("https://example.invalid", { method: "POST", body: JSON.stringify({ action: "website_access", websiteId, ownerId: "forged-owner" }) });
function context(viewer = "member-b", visible = true) {
  return { userClaims: { id: viewer }, supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: visible ? { id: websiteId, organizations: { owner_id: "owner-a" } } : null }) }) }) }) }, supabaseAdmin: {} };
}
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });
it("rejects missing identity and inaccessible websites before reading private billing", async () => {
  expect((await billing.fetch(request(), context("") as never)).status).toBe(401);
  expect((await billing.fetch(request(), context("outsider", false) as never)).status).toBe(403);
  expect(access).not.toHaveBeenCalled();
});
it("gives an authorized member the owner's feature access without exposing payment details", async () => {
  vi.stubGlobal("Deno", { env: { get: () => { throw new Error("Feature read must not need Stripe configuration"); } } });
  access.mockResolvedValue({ ownerId: "owner-a", limits: { articles: 4 }, trial: false });
  const response = await billing.fetch(request(), context() as never);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ canRunPaidWork: true, canManageBilling: false });
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(access).toHaveBeenCalledWith(expect.anything(), websiteId);
});
it("shows billing management only to the actual website owner and does not grant unpaid work", async () => {
  access.mockResolvedValue(null);
  const response = await billing.fetch(request(), context("owner-a") as never);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ canRunPaidWork: false, canManageBilling: true });
});
