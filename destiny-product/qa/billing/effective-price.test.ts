import { describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { stripeBillingPrice } from "../../supabase/functions/_shared/billing/effective-price";

const account = { ownerId: "owner-a", customerId: "cus_a", subscriptionId: "sub_a", livemode: true };

function gateway(overrides: { customer?: unknown; subscription?: unknown; invoice?: unknown; previewError?: Error } = {}) {
  const retrieveCustomer = vi.fn(async () => overrides.customer ?? ({ id: "cus_a", deleted: false, livemode: true, metadata: { rebound_owner_id: "owner-a" } }));
  const retrieveSubscription = vi.fn(async () => overrides.subscription ?? ({ id: "sub_a", customer: "cus_a", livemode: true, status: "active" }));
  const createPreview = vi.fn(async () => {
    if (overrides.previewError) throw overrides.previewError;
    return overrides.invoice ?? {
      id: "upcoming_in_fixture", customer: "cus_a", livemode: true, currency: "usd", subtotal: 25000,
      amount_due: 0, period_end: 1792571769,
      discounts: [{ id: "di_secret", deleted: false, end: null, source: { type: "coupon", coupon: {
        id: "coupon_secret", deleted: false, name: "Complimentary owner access", duration: "forever", duration_in_months: null,
        percent_off: 100, amount_off: null, currency: null,
      } } }],
    };
  });
  return { stripe: { customers: { retrieve: retrieveCustomer }, subscriptions: { retrieve: retrieveSubscription }, invoices: { createPreview } } as unknown as Stripe,
    retrieveCustomer, retrieveSubscription, createPreview };
}

describe("Stripe effective billing price", () => {
  it("returns a bounded next-payment summary without Stripe identifiers", async () => {
    const { stripe, createPreview } = gateway();
    await expect(stripeBillingPrice(stripe, account)).resolves.toEqual({
      currency: "usd", catalogSubtotalCents: 25000, nextPaymentCents: 0, nextPaymentAt: "2026-10-21T05:56:09.000Z",
      discounts: [{ name: "Complimentary owner access", duration: "forever", endsAt: null, percentOff: 100, amountOffCents: null }],
    });
    expect(createPreview).toHaveBeenCalledWith({ customer: "cus_a", subscription: "sub_a", expand: ["discounts", "discounts.source.coupon"] });
    expect(JSON.stringify(await stripeBillingPrice(stripe, account))).not.toMatch(/cus_a|sub_a|coupon_secret|di_secret/);
  });

  it("returns unavailable for missing, cross-customer or wrong-mode billing identities", async () => {
    await expect(stripeBillingPrice(gateway().stripe, { ...account, subscriptionId: null })).resolves.toBeNull();
    await expect(stripeBillingPrice(gateway({ customer: { id: "cus_a", deleted: false, livemode: true, metadata: { rebound_owner_id: "other" } } }).stripe, account)).resolves.toBeNull();
    await expect(stripeBillingPrice(gateway({ subscription: { id: "sub_a", customer: "cus_other", livemode: true, status: "active" } }).stripe, account)).resolves.toBeNull();
    await expect(stripeBillingPrice(gateway({ invoice: { customer: "cus_a", livemode: false, currency: "usd", subtotal: 25000, amount_due: 0, period_end: 1792571769, discounts: [] } }).stripe, account)).resolves.toBeNull();
  });

  it("keeps billing readiness independent when Stripe cannot preview the next invoice", async () => {
    await expect(stripeBillingPrice(gateway({ previewError: new Error("provider unavailable") }).stripe, account)).resolves.toBeNull();
  });

  it("sanitizes amount discounts and untrusted coupon labels", async () => {
    const invoice = {
      customer: "cus_a", livemode: true, currency: "usd", subtotal: 25000, amount_due: 20000, period_end: 1792571769,
      discounts: [{ end: 1795163769, source: { type: "coupon", coupon: {
        name: "  Save $50\nthis month with a deliberately oversized internal label that should never reach the page intact  ",
        duration: "repeating", duration_in_months: 3, percent_off: null, amount_off: 5000, currency: "usd",
      } } }],
    };
    const summary = await stripeBillingPrice(gateway({ invoice }).stripe, account);
    expect(summary?.discounts).toEqual([{ name: "Save $50 this month with a deliberately oversized internal label that should never reach", duration: "repeating", endsAt: "2026-11-20T05:56:09.000Z", percentOff: null, amountOffCents: 5000 }]);
  });
});
