import Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, expect, it, vi } from "vitest";
const { order } = vi.hoisted(() => ({ order: [] as string[] }));
vi.mock("../../supabase/functions/_shared/billing/store.ts", () => ({
  BillingOperationError: class extends Error {},
  withBillingOperation: async (_db: unknown, _owner: string, _mode: boolean, run: (account: unknown, token: string) => Promise<unknown>) => {
    order.push("lease"); return run({ stripe_customer_id: "cus_a" }, "token");
  },
}));
import { reconcileStripeEvent } from "../../supabase/functions/_shared/billing/webhook-service";
const rpc = vi.fn();
const db = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { owner_id: "owner-a" }, error: null }) }) }) }), rpc } as unknown as SupabaseClient;
const retrieve = vi.fn(), list = vi.fn();
const stripe = { accounts: { retrieve: async () => ({ id: "acct_a" }) }, subscriptions: { list, retrieve } } as unknown as Stripe;
const config = { key: "sk_test_fixture", accountId: "acct_a", webhookSecret: "whsec_fixture", livemode: false, origin: "https://app.reboundseo.com", priceIds: { starter: "price_a", growth: "price_b", premium: "price_c" } };
const event = { id: "evt_old", type: "customer.subscription.updated", livemode: false, data: { object: { customer: "cus_a", status: "active" } } } as unknown as Stripe.Event;
beforeEach(() => {
  vi.clearAllMocks(); order.length = 0;
  list.mockImplementation(async () => { order.push("stripe"); return { data: [{ id: "sub_a", status: "canceled", created: 1 }], has_more: false }; });
  retrieve.mockResolvedValue({ id: "sub_a", customer: "cus_a", livemode: false, status: "canceled", trial_start: null, items: { data: [{ id: "si_a", quantity: 1, price: { id: "price_a", unit_amount: 3900, currency: "usd", recurring: { interval: "month", interval_count: 1 } }, current_period_start: 100, current_period_end: 200 }], has_more: false } });
  rpc.mockResolvedValue({ data: true, error: null });
});
it("reads current subscription under the lease instead of replaying an old event status", async () => {
  await reconcileStripeEvent(db, stripe, config, event);
  expect(order).toEqual(["lease", "stripe"]);
  expect(rpc.mock.calls[0]).toMatchObject(["apply_billing_snapshot", { p_owner_id: "owner-a", p_token: "token", p_event_id: "evt_old", p_snapshot: { status: "canceled" } }]);
});
it("rejects wrong-mode notifications before database or Stripe mutations", async () => {
  await expect(reconcileStripeEvent(db, stripe, config, { ...event, livemode: true })).rejects.toThrow();
  expect(list).not.toHaveBeenCalled(); expect(rpc).not.toHaveBeenCalled();
});
it("refuses to guess between multiple current subscriptions", async () => {
  list.mockResolvedValue({ data: [{ id: "sub_a", status: "active" }, { id: "sub_b", status: "trialing" }], has_more: false });
  await expect(reconcileStripeEvent(db, stripe, config, event)).rejects.toThrow();
  expect(rpc).not.toHaveBeenCalled();
});
it("surfaces failed atomic saves so Stripe can retry", async () => {
  rpc.mockResolvedValue({ data: null, error: { message: "lease expired" } });
  await expect(reconcileStripeEvent(db, stripe, config, event)).rejects.toThrow();
});
