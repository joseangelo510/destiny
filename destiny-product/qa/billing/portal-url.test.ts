import { expect, it, vi } from "vitest";
vi.mock("@/lib/db/billing", () => ({ billingSessionClient: vi.fn() }));
import { hostedPaymentUrl } from "@/lib/billing/payment-action";
it("accepts current and legacy Stripe portal session URL formats", () => {
  for (const url of ["https://billing.stripe.com/p/session?token=test", "https://billing.stripe.com/p/session/test"])
    expect(hostedPaymentUrl(url, "portal")).toBe(url);
});
it("rejects portal lookalikes, credentials and unexpected routes", () => {
  for (const url of ["https://billing.stripe.com.evil.invalid/p/session", "http://billing.stripe.com/p/session", "https://user@billing.stripe.com/p/session", "https://billing.stripe.com/p/session-other", "https://billing.stripe.com/"])
    expect(hostedPaymentUrl(url, "portal")).toBeNull();
});
