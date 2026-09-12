import { expect, it } from "vitest";
import { billingFailureResponse } from "@/lib/billing/failure-response";
it("preserves a quota wall through the research proxy without leaking upstream text", async () => {
  const context = Response.json({ code: "BILLING_LIMIT_REACHED", error: "upstream private detail", billingUrl: "https://untrusted.invalid" }, { status: 402 });
  const response = await billingFailureResponse({ context });
  expect(response?.status).toBe(402);
  expect(await response?.json()).toMatchObject({ code: "BILLING_LIMIT_REACHED", billingUrl: "/account/billing" });
  expect(context.bodyUsed).toBe(false);
});
it("does not relabel ordinary provider errors as a payment wall", async () => {
  expect(await billingFailureResponse({ context: Response.json({ error: "provider" }, { status: 502 }) })).toBeNull();
});
it("preserves the verified-email requirement without exposing provider text", async () => {
  const response = await billingFailureResponse({ context: Response.json({ code: "BILLING_VERIFICATION_REQUIRED", error: "private" }, { status: 403 }) });
  expect(response?.status).toBe(403);
  expect(await response?.json()).toMatchObject({ code: "BILLING_VERIFICATION_REQUIRED", error: "Verify your sign-in email before starting this work." });
});
