import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, expect, it, vi } from "vitest";
import { meteredResponse } from "../../supabase/functions/_shared/billing/metered-work";
const rpc = vi.fn();
const admin = { rpc } as unknown as SupabaseClient;
const operation = vi.fn();
const input = { ownerId: "owner-a", meter: "keywordSearches" as const, requestKey: "research-request-1" };
beforeEach(() => { vi.clearAllMocks(); rpc.mockResolvedValue({ data: { allowed: true, id: "usage-a" }, error: null }); operation.mockResolvedValue(Response.json({ rows: [] })); });
it("does not call the provider when allowance is exhausted", async () => {
  rpc.mockResolvedValue({ data: { allowed: false, reason: "limit_reached" }, error: null });
  const response = await meteredResponse(admin, input, operation);
  expect(response.status).toBe(402);
  expect(await response.json()).toMatchObject({ code: "BILLING_LIMIT_REACHED", billingUrl: "/account/billing" });
  expect(operation).not.toHaveBeenCalled();
});
it("does not replay an already reserved operation", async () => {
  rpc.mockResolvedValue({ data: { allowed: false, reason: "duplicate" }, error: null });
  expect((await meteredResponse(admin, input, operation)).status).toBe(409);
  expect(operation).not.toHaveBeenCalled();
});
it("settles successful work only after the provider completes", async () => {
  await meteredResponse(admin, input, operation);
  expect(rpc.mock.calls[0]).toEqual(["reserve_billing_usage", { p_owner_id: "owner-a", p_website_id: null, p_request_key: input.requestKey, p_meter: "keywordSearches", p_units: 1 }]);
  expect(rpc.mock.calls[1]).toEqual(["finish_billing_usage", { p_id: "usage-a", p_success: true, p_provider_cost_usd: null }]);
});
it("returns the unit on a failed provider response", async () => {
  operation.mockResolvedValue(Response.json({ error: "provider unavailable" }, { status: 502 }));
  expect((await meteredResponse(admin, input, operation)).status).toBe(502);
  expect(rpc.mock.calls[1][1].p_success).toBe(false);
});
it("returns failed units on exceptions and blocks provider work if reservation is unavailable", async () => {
  operation.mockRejectedValue(new Error("provider timeout"));
  expect((await meteredResponse(admin, input, operation)).status).toBe(502);
  expect(rpc.mock.calls[1][1].p_success).toBe(false);
  vi.clearAllMocks(); rpc.mockResolvedValue({ data: null, error: { message: "database unavailable" } });
  expect((await meteredResponse(admin, input, operation)).status).toBe(503);
  expect(operation).not.toHaveBeenCalled();
});
