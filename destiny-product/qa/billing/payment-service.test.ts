import Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
const { account } = vi.hoisted(() => ({ account: { owner_id: "owner-a", stripe_customer_id: "cus_a", stripe_subscription_id: null, trial_started_at: null, livemode: false } }));
vi.mock("../../supabase/functions/_shared/billing/store.ts", () => ({
  BillingOperationError: class extends Error { constructor(public code: string) { super(code); } },
  withBillingOperation: async (_db: unknown, _owner: string, _live: boolean, run: (account: unknown, token: string) => Promise<unknown>) => run(account, "lease-token"),
  saveStripeCustomer: vi.fn(), assertBillingOperation: vi.fn(),
}));
import { paymentAction, verifyBillingConfiguration } from "../../supabase/functions/_shared/billing/payment-service";
const config = { key: "sk_test_fixture", webhookSecret: "whsec_fixture", portalConfigurationId: "bpc_fixture", accountId: "acct_a", livemode: false, origin: "https://app.reboundseo.com", priceIds: { starter: "price_a", growth: "price_b", premium: "price_c" } };
const createPortal = vi.fn(), create = vi.fn(), listSubscriptions = vi.fn(), listSessions = vi.fn(), expire = vi.fn(), retrieveCustomer = vi.fn();
const fake = {
  billingPortal: { sessions: { create: createPortal } },
  customers: { retrieve: retrieveCustomer },
  subscriptions: { list: listSubscriptions },
  checkout: { sessions: { create, list: listSessions, expire, listLineItems: async () => ({ data: [{ price: { id: "price_b" } }], has_more: false }) } },
};
const stripe = fake as unknown as Stripe;
const admin = {} as SupabaseClient;
describe("payment service subscription protection", () => {
  beforeEach(() => {
    vi.clearAllMocks(); createPortal.mockResolvedValue({ url: "https://billing.stripe.com/p/session/fixture" }); retrieveCustomer.mockResolvedValue({ id: "cus_a", livemode: false, metadata: { rebound_owner_id: "owner-a" } });
    listSubscriptions.mockResolvedValue({ data: [], has_more: false }); listSessions.mockResolvedValue({ data: [], has_more: false });
    create.mockResolvedValue({ url: "https://checkout.stripe.com/c/pay/example", livemode: false });
  });
  it("checks current Stripe subscriptions before creating a second one", async () => {
    listSubscriptions.mockResolvedValue({ data: [{ status: "trialing" }], has_more: false });
    await expect(paymentAction(admin, stripe, config, "owner-a", "checkout", "growth")).rejects.toThrow("subscription_exists");
    expect(create).not.toHaveBeenCalled();
  });
  it("does not repeat a trial after a canceled trial or reuse an obsolete trial session", async () => {
    listSubscriptions.mockResolvedValue({ data: [{ status: "canceled", trial_start: 1000 }], has_more: false });
    listSessions.mockResolvedValue({ data: [{ id: "cs_old", client_reference_id: "owner-a", mode: "subscription", url: "https://checkout.stripe.com/c/pay/old", metadata: { rebound_trial: "true" } }], has_more: false });
    await paymentAction(admin, stripe, config, "owner-a", "checkout", "growth");
    expect(expire).toHaveBeenCalledWith("cs_old");
    expect(create.mock.calls[0][0].subscription_data.trial_period_days).toBeUndefined();
  });
  it("refuses a Stripe customer that belongs to another owner", async () => {
    retrieveCustomer.mockResolvedValue({ livemode: false, metadata: { rebound_owner_id: "other" } });
    await expect(paymentAction(admin, stripe, config, "owner-a", "checkout", "growth")).rejects.toThrow("customer_owner_mismatch");
    expect(create).not.toHaveBeenCalled();
  });
  it("requires the configured Stripe account and prices", async () => {
    const gateway = { accounts: { retrieve: async () => ({ id: "acct_other" }) } } as unknown as Stripe;
    await expect(verifyBillingConfiguration(gateway, config)).rejects.toThrow("stripe_account_unavailable");
  });
  it("pins portal sessions to the reviewed configuration instead of an account default", async () => {
    await paymentAction(admin, stripe, config, "owner-a", "portal");
    expect(createPortal).toHaveBeenCalledWith({ customer: "cus_a", return_url: "https://app.reboundseo.com/account/billing", configuration: "bpc_fixture" });
  });

  it("rejects an inactive or wrong-mode portal before exposing checkout", async () => {
    const retrievePortal = vi.fn(async () => ({ id: "bpc_fixture", active: false, livemode: false }));
    const gateway = {
      accounts: { retrieve: async () => ({ id: "acct_a" }) },
      prices: { retrieve: async (id: string) => ({ active: true, livemode: false, currency: "usd", type: "recurring", unit_amount: { price_a: 3900, price_b: 9900, price_c: 25000 }[id], recurring: { interval: "month", interval_count: 1 } }) },
      billingPortal: { configurations: { retrieve: retrievePortal } },
    } as unknown as Stripe;
    await expect(verifyBillingConfiguration(gateway, config)).rejects.toThrow("stripe_portal_unavailable");
    retrievePortal.mockResolvedValue({ id: "bpc_fixture", active: true, livemode: true });
    await expect(verifyBillingConfiguration(gateway, config)).rejects.toThrow("stripe_portal_unavailable");
    retrievePortal.mockResolvedValue({ id: "bpc_fixture", active: true, livemode: false });
    await expect(verifyBillingConfiguration(gateway, config)).resolves.toBeUndefined();
    expect(retrievePortal).toHaveBeenCalledWith("bpc_fixture");
  });

});
