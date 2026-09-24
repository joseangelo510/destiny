import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PricingPlans, BillingNotice, EffectivePriceSummary } from "@/components/billing/pricing-plans";

describe("pricing and work walls", () => {
  it("discloses price, pooled quotas, card requirement and trial boundaries before checkout", () => {
    const html = renderToStaticMarkup(<PricingPlans checkoutReady trialEligible />);
    for (const text of ["$39", "$99", "$250", "7-day", "Card required", "across all your websites", "2 articles", "Cancel"]) expect(html).toContain(text);
    expect(html.match(/action="\/api\/billing\/checkout"/g)).toHaveLength(3);
    expect(html).not.toContain("unlimited");
  });
  it("does not offer another trial to an ineligible customer", () => {
    const html = renderToStaticMarkup(<PricingPlans checkoutReady trialEligible={false} />);
    expect(html).toContain("Subscribe to Starter");
    expect(html).not.toContain("Start 7-day trial");
  });
  it("never offers a working checkout while billing setup is incomplete", () => {
    const html = renderToStaticMarkup(<PricingPlans checkoutReady={false} trialEligible />);
    expect(html.match(/disabled=""/g)).toHaveLength(3);
    expect(html).toContain("Payment setup is in progress");
  });
  it("offers recovery while preserving saved work", () => {
    for (const reason of ["trial_ended", "payment_required", "limit_reached"] as const) {
      const html = renderToStaticMarkup(<BillingNotice reason={reason} />);
      expect(html).toContain("saved work");
      expect(html).toContain('/account/billing');
    }
  });
  it("separates the catalog price from the authenticated Stripe estimate", () => {
    const html = renderToStaticMarkup(<EffectivePriceSummary catalogCents={25000} pricing={{
      currency: "usd", catalogSubtotalCents: 25000, nextPaymentCents: 0, nextPaymentAt: "2026-10-21T16:36:09.000Z",
      discounts: [{ name: "Complimentary owner access", duration: "forever", endsAt: null, percentOff: 100, amountOffCents: null }],
    }} />);
    for (const text of ["Catalog price", "$250.00 / month", "Estimated next payment", "$0.00", "October 21, 2026", "Complimentary owner access", "100% off", "Ongoing"]) expect(html).toContain(text);
  });
  it("does not turn a missing Stripe estimate into a claimed charge", () => {
    const html = renderToStaticMarkup(<EffectivePriceSummary catalogCents={25000} pricing={null} />);
    expect(html).toContain("Catalog price");
    expect(html).toContain("Effective payment estimate unavailable");
    expect(html).not.toContain("Estimated next payment");
  });
});
