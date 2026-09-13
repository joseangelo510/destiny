import { afterEach, expect, it, vi } from "vitest";
const { client, claims, invoke } = vi.hoisted(() => ({ client: vi.fn(), claims: vi.fn(), invoke: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/billing", () => ({ billingSessionClient: client }));
import { loadWebsiteEntitlement } from "../../src/lib/billing/website-entitlement";
afterEach(() => vi.resetAllMocks());
const denied = { canRunPaidWork: false, canManageBilling: false };
it("does not make a private read without a selected website and verified claims", async () => {
  expect(await loadWebsiteEntitlement(undefined)).toEqual(denied);
  expect(client).not.toHaveBeenCalled();
  client.mockResolvedValue({ getClaims: claims, invoke });
  claims.mockResolvedValue(null);
  expect(await loadWebsiteEntitlement("site-a")).toEqual(denied);
  expect(invoke).not.toHaveBeenCalled();
});
it("uses the selected site and trusts only explicit true booleans", async () => {
  client.mockResolvedValue({ getClaims: claims, invoke });
  claims.mockResolvedValue({ id: "member" });
  invoke.mockResolvedValue({ data: { canRunPaidWork: true, canManageBilling: false } });
  expect(await loadWebsiteEntitlement("site-a")).toEqual({ canRunPaidWork: true, canManageBilling: false });
  expect(invoke).toHaveBeenCalledWith({ action: "website_access", websiteId: "site-a" });
  invoke.mockResolvedValue({ data: { canRunPaidWork: "true", canManageBilling: 1 } });
  expect(await loadWebsiteEntitlement("site-a")).toEqual(denied);
  invoke.mockResolvedValue({ data: { canRunPaidWork: true }, error: new Error("Unavailable") });
  expect(await loadWebsiteEntitlement("site-a")).toEqual(denied);
  client.mockRejectedValue(new Error("Unavailable"));
  expect(await loadWebsiteEntitlement("site-a")).toEqual(denied);
});
