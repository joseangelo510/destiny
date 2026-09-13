import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, it, vi } from "vitest";
import { websitePaidAccess } from "../../supabase/functions/_shared/billing/website-access";
const now = Date.parse("2026-09-13T00:00:00Z");
const account = { plan: "starter", status: "active", period_start: "2026-09-01T00:00:00Z", period_end: "2026-10-01T00:00:00Z", paid_through: "2026-10-01T00:00:00Z" };
function fixture(data: unknown, error: unknown = null) {
  const rpc = vi.fn(async () => ({ data, error }));
  const admin = { rpc, from: (table: string) => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: table === "websites" ? { organizations: { owner_id: "owner-a" } } : account, error: null }) }) }) }) } as unknown as SupabaseClient;
  return { admin, rpc };
}
it("allows paid website work only for a selected website under its actual owner", async () => {
  const { admin, rpc } = fixture(true);
  expect(await websitePaidAccess(admin, "site-a", now)).toMatchObject({ ownerId: "owner-a", trial: false });
  expect(rpc).toHaveBeenCalledWith("is_billing_website_managed", { p_owner_id: "owner-a", p_website_id: "site-a" });
});
it.each([false, null, "true", {}, 1])("denies unselected or malformed managed-site access: %j", async value => {
  expect(await websitePaidAccess(fixture(value).admin, "site-a", now)).toBeNull();
});
it("fails closed when managed-site verification fails", async () => {
  expect(await websitePaidAccess(fixture(true, { message: "Unavailable" }).admin, "site-a", now)).toBeNull();
});
