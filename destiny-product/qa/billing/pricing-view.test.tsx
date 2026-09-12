import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PricingPlans, BillingNotice } from "@/components/billing/pricing-plans";

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
});
