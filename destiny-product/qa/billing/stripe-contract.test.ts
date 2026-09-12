import Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { checkoutParameters, validateSubscription, verifyStripeEvent } from "@/lib/billing/stripe-contract";

const priceIds = { starter: "price_starter", growth: "price_growth", premium: "price_premium" };
const subscription = { id: "sub_123", customer: "cus_123", livemode: false, status: "active", items: { data: [{ id: "si_123", price: { id: "price_growth", currency: "usd", unit_amount: 9900, recurring: { interval: "month", interval_count: 1 } }, quantity: 1, current_period_start: 1000, current_period_end: 2000 }] }, latest_invoice: { status: "paid", subscription: "sub_123", period_end: 2000, lines: { data: [{ parent: { subscription_item_details: { subscription_item: "si_123", proration: false } }, pricing: { price_details: { price: "price_growth" } }, period: { start: 1000, end: 2000 } }] } }, trial_start: null, trial_end: null, cancel_at_period_end: false };
describe("Stripe contract boundaries", () => {
  it("uses only server-owned prices, account identity and return URLs", () => {
    const params = checkoutParameters({ ownerId: "owner-a", customerId: "cus_123", plan: "growth", trialEligible: true, origin: "https://app.reboundseo.com", priceIds });
    expect(params).toMatchObject({ mode: "subscription", customer: "cus_123", payment_method_collection: "always", client_reference_id: "owner-a", line_items: [{ price: "price_growth", quantity: 1 }], subscription_data: { trial_period_days: 7 } });
    expect(params.success_url).toBe("https://app.reboundseo.com/account/billing?checkout=returned");
    expect(checkoutParameters({ ownerId: "owner-a", customerId: "cus_123", plan: "starter", trialEligible: false, origin: "https://app.reboundseo.com", priceIds }).subscription_data?.trial_period_days).toBeUndefined();
  });
  it("rejects test/live, customer, price, quantity and recurring-price mismatches", () => {
    expect(validateSubscription(subscription as unknown as Stripe.Subscription, { customerId: "cus_123", livemode: false, priceIds }).plan).toBe("growth");
    for (const mutation of [{ customer: "cus_other" }, { livemode: true }, { items: { data: [] } }, { items: { data: [{ ...subscription.items.data[0], quantity: 2 }] } }, { items: { data: [{ ...subscription.items.data[0], price: { ...subscription.items.data[0].price, unit_amount: 100 } }] } }]) {
      expect(() => validateSubscription({ ...subscription, ...mutation } as unknown as Stripe.Subscription, { customerId: "cus_123", livemode: false, priceIds })).toThrow();
    }
  });
  it("only accepts a fresh valid signature for the raw body and expected mode", () => {
    const secret = "whsec_test_fixture_only";
    const payload = JSON.stringify({ id: "evt_123", type: "customer.subscription.updated", livemode: false, data: { object: subscription } });
    const stripe = new Stripe("sk_test_fixture_only");
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
    expect(verifyStripeEvent(payload, header, secret, false).id).toBe("evt_123");
    expect(() => verifyStripeEvent(payload + " ", header, secret, false)).toThrow();
    expect(() => verifyStripeEvent(payload, header, secret, true)).toThrow();
    const stale = stripe.webhooks.generateTestHeaderString({ payload, secret, timestamp: Math.floor(Date.now() / 1000) - 600 });
    expect(() => verifyStripeEvent(payload, stale, secret, false)).toThrow();
  });
});
