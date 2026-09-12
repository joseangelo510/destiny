import { expect, it } from "vitest";
import { signWorkerRequest, verifyWorkerRequest } from "../../supabase/functions/_shared/billing/worker-auth";
const secret = "fixture_only_012345678901234567890123456789";
it("authenticates the exact body and destination with a short timestamp window", async () => {
  const now = Date.now();
  const body = JSON.stringify({ action: "finish", id: "usage-a", succeeded: false });
  const headers = await signWorkerRequest(body, "billing-usage", secret, now);
  expect(await verifyWorkerRequest(body, "billing-usage", new Headers(headers), secret, now)).toBe(true);
  expect(await verifyWorkerRequest(body + " ", "billing-usage", new Headers(headers), secret, now)).toBe(false);
  expect(await verifyWorkerRequest(body, "seo-research", new Headers(headers), secret, now)).toBe(false);
  expect(await verifyWorkerRequest(body, "billing-usage", new Headers(headers), secret, now+301000)).toBe(false);
  expect(await verifyWorkerRequest(body, "billing-usage", new Headers(), secret, now)).toBe(false);
});
it("refuses missing or undersized server credentials", async () => {
  await expect(signWorkerRequest("{}", "billing-usage", "short")).rejects.toThrow();
  expect(await verifyWorkerRequest("{}", "billing-usage", new Headers(), "")).toBe(false);
});
