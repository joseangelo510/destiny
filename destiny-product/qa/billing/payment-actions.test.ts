import { beforeEach, describe, expect, it, vi } from "vitest";
const { getClaims, invoke } = vi.hoisted(() => ({ getClaims: vi.fn(), invoke: vi.fn() }));
vi.mock("@/lib/db/billing", () => ({ billingSessionClient: async () => ({ getClaims, invoke }) }));
import { POST as checkout } from "@/app/api/billing/checkout/route";
import { POST as portal } from "@/app/api/billing/portal/route";
function request(action = "checkout", origin = "https://app.reboundseo.com", fields = { plan: "growth" }) {
  return new Request(`https://app.reboundseo.com/api/billing/${action}`, { method: "POST", headers: { Origin: origin }, body: new URLSearchParams(fields) });
}
describe("payment action trust boundaries", () => {
  beforeEach(() => { vi.clearAllMocks(); getClaims.mockResolvedValue("owner-a"); invoke.mockResolvedValue({ data: { url: "https://checkout.stripe.com/c/pay/cs_test_a" }, error: null }); });
  it("rejects cross-origin forms and missing authentication before calling Stripe", async () => {
    expect((await checkout(request("checkout", "https://other.invalid"))).status).toBe(403);
    expect(invoke).not.toHaveBeenCalled();
    getClaims.mockResolvedValue(null);
    expect((await checkout(request())).status).toBe(401);
    expect(invoke).not.toHaveBeenCalled();
  });
  it("sends only the selected known plan to the authenticated billing service", async () => {
    const result = await checkout(request("checkout", undefined, { plan: "growth", customer: "cus_victim", owner: "victim", price: "price_cheap" } as { plan: string }));
    expect(result.status).toBe(303);
    expect(invoke).toHaveBeenCalledWith({ action: "checkout", plan: "growth" });
    expect(result.headers.get("Location")).toBe("https://checkout.stripe.com/c/pay/cs_test_a");
    expect(result.headers.get("Cache-Control")).toBe("private, no-store");
  });
  it("redirects to the current hosted checkout URL returned by live Stripe", async () => {
    const url = "https://checkout.stripe.com/g/pay/cs_live_example#checkout-state";
    invoke.mockResolvedValue({ data: { url }, error: null });
    const result = await checkout(request());
    expect(result.status).toBe(303);
    expect(result.headers.get("Location")).toBe(url);
    expect(result.headers.get("Cache-Control")).toBe("private, no-store");
  });
  it("rejects unknown plans and untrusted redirect targets", async () => {
    expect((await checkout(request("checkout", undefined, { plan: "enterprise" }))).status).toBe(400);
    expect(invoke).not.toHaveBeenCalled();
    for (const url of ["https://checkout.stripe.com.evil.invalid/c/pay/a", "http://checkout.stripe.com/c/pay/a", "javascript:alert(1)", "https://billing.stripe.com/p/session/a", "https://checkout.stripe.com.evil.invalid/g/pay/a", "http://checkout.stripe.com/g/pay/a", "https://user@checkout.stripe.com/g/pay/a", "https://checkout.stripe.com/g/pay-other/a", "https://checkout.stripe.com/p/session/a"]) {
      invoke.mockResolvedValue({ data: { url }, error: null });
      const result = await checkout(request());
      expect(result.headers.get("Location")).toBe("https://app.reboundseo.com/account/billing?billing_error=unavailable");
    }
  });
  it("opens only the authenticated customer's hosted portal and hides upstream errors", async () => {
    invoke.mockResolvedValue({ data: { url: "https://billing.stripe.com/p/session/example" }, error: null });
    expect((await portal(request("portal"))).headers.get("Location")).toBe("https://billing.stripe.com/p/session/example");
    expect(invoke).toHaveBeenCalledWith({ action: "portal" });
    invoke.mockResolvedValue({ data: null, error: { message: "secret provider details" } });
    const result = await portal(request("portal"));
    expect(result.status).toBe(303);
    expect(await result.text()).not.toContain("secret");
  });
});
