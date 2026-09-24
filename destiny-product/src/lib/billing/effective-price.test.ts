import { describe, expect, it } from "vitest";
import { parseEffectiveBillingPrice } from "./effective-price";

describe("effective billing price response", () => {
  it("accepts the bounded authenticated response", () => {
    expect(parseEffectiveBillingPrice({ currency: "usd", catalogSubtotalCents: 25000, nextPaymentCents: 0, nextPaymentAt: "2026-10-21T16:36:09.000Z", discounts: [
      { name: "Complimentary owner access", duration: "forever", endsAt: null, percentOff: 100, amountOffCents: null },
    ] })).toMatchObject({ nextPaymentCents: 0, discounts: [{ name: "Complimentary owner access" }] });
  });
  it("rejects invalid money, dates and discount fields", () => {
    for (const value of [null, {}, { currency: "usd", catalogSubtotalCents: -1, nextPaymentCents: 0, nextPaymentAt: "bad", discounts: [] },
      { currency: "secret", catalogSubtotalCents: 25000, nextPaymentCents: 0, nextPaymentAt: "2026-10-21T16:36:09.000Z", discounts: [] },
      { currency: "usd", catalogSubtotalCents: 25000, nextPaymentCents: 0, nextPaymentAt: "2026-10-21T16:36:09.000Z", discounts: [{ name: "x", duration: "forever", endsAt: null, percentOff: 101, amountOffCents: null }] }]) {
      expect(parseEffectiveBillingPrice(value)).toBeNull();
    }
  });
});
