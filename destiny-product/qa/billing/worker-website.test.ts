import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { finishContentWork } from "../../src/lib/billing/worker";
import { verifyWorkerRequest } from "../../supabase/functions/_shared/billing/worker-auth";
afterEach(() => vi.unstubAllEnvs());
it("binds the website scope into the server signature when settling content usage", async () => {
  const secret = "fixture_only_settlement_012345678901234567890123456789";
  vi.stubEnv("BILLING_WORKER_SECRET", secret);
  const invoke = vi.fn(async (_endpoint: string, options: { body: string; headers: Record<string, string> }) => {
    expect(JSON.parse(options.body)).toEqual({ action: "finish", id: "receipt", succeeded: true, websiteId: "site-a" });
    expect(await verifyWorkerRequest(options.body, "billing-usage", new Headers(options.headers), secret)).toBe(true);
    expect(await verifyWorkerRequest(options.body.replace("site-a", "site-b"), "billing-usage", new Headers(options.headers), secret)).toBe(false);
    return { data: { saved: true }, error: null };
  });
  expect(await finishContentWork({ functions: { invoke } } as never, "receipt", true, "site-a")).toBe(true);
  expect(invoke).toHaveBeenCalledTimes(1);
});
