import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db/billing", () => ({ billingSessionClient: vi.fn() }));
import { billingOrigin } from "@/lib/billing/payment-action";
const req = (url: string, origin?: string) => new Request(url, { method: "POST", headers: origin ? { Origin: origin } : {} });
afterEach(() => vi.unstubAllEnvs());
describe("local billing origin aliases", () => {
  it("accepts the actual loopback browser origin when Next normalizes the hostname", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(billingOrigin(req("http://localhost:4173/api/billing/portal", "http://127.0.0.1:4173"))).toBe("http://127.0.0.1:4173");
    expect(billingOrigin(req("http://127.0.0.1:4173/api/billing/checkout", "http://localhost:4173"))).toBe("http://localhost:4173");
  });
  it("rejects foreign, missing, different-port and different-scheme local origins", () => {
    vi.stubEnv("NODE_ENV", "development");
    for (const origin of [undefined, "null", "https://evil.invalid", "http://localhost:4174", "https://localhost:4173", "http://localhost.evil.invalid:4173"]) {
      expect(billingOrigin(req("http://localhost:4173/api/billing/portal", origin))).toBeNull();
    }
  });
  it("does not allow localhost origins in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(billingOrigin(req("http://localhost:4173/api/billing/portal", "http://127.0.0.1:4173"))).toBeNull();
    expect(billingOrigin(req("https://app.reboundseo.com/api/billing/portal", "https://app.reboundseo.com"))).toBe("https://app.reboundseo.com");
  });
});
