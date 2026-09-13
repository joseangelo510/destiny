import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, it } from "vitest";
import { rankTrackingAccess } from "../../supabase/functions/_shared/billing/rank-access";
function db(account: unknown) {
  return { rpc: async () => ({ data: true, error: null }), from: (table: string) => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: table === "websites" ? { organizations: { owner_id: "owner-a" } } : account, error: null }) }) }) }) } as unknown as SupabaseClient;
}
const state = { plan: "starter", status: "active", period_start: "2026-09-01T00:00:00Z", period_end: "2026-10-01T00:00:00Z", paid_through: "2026-10-01T00:00:00Z", trial_end: null };
it("blocks scheduled checks for unpaid and expired accounts", async () => {
  const now = Date.parse("2026-09-12T00:00:00Z");
  for (const status of ["past_due", "canceled", "unpaid", "paused"]) expect(await rankTrackingAccess(db({ ...state, status }), "site-a", now)).toBeNull();
  expect(await rankTrackingAccess(db({ ...state, status: "trialing", trial_end: "2026-09-11T00:00:00Z" }), "site-a", now)).toBeNull();
  expect(await rankTrackingAccess(db(null), "site-a", now)).toBeNull();
});
it("returns the pooled tracking limit for the website owner", async () => {
  expect(await rankTrackingAccess(db(state), "site-a", Date.parse("2026-09-12T00:00:00Z"))).toEqual({ ownerId: "owner-a", limit: 25, trial: false });
});
