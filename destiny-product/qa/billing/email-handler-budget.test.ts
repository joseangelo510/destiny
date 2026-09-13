import { expect, it, vi } from "vitest";
vi.mock("@supabase/server", () => ({ withSupabase: (_options: unknown, handler: unknown) => handler }));
const { send, reserve } = vi.hoisted(() => ({ send: vi.fn(), reserve: vi.fn(async () => ({ allowed: false, reason: "limit_reached" })) }));
vi.mock("../../supabase/functions/_shared/billing/email-budget.ts", () => ({ reserveTransactionalEmail: reserve }));
vi.mock("../../supabase/functions/send-welcome/email.ts", () => ({ sendWelcomeEmail: send }));
vi.mock("../../supabase/functions/progress-report/email.ts", () => ({ sendProgressReport: send }));
import welcome from "../../supabase/functions/send-welcome/index";
import progress from "../../supabase/functions/progress-report/index";
it.each([["welcome", welcome, 200], ["progress", progress, 429]] as const)("stops %s provider work when email budget is exhausted", async (kind, worker, status) => {
  send.mockClear(); reserve.mockClear();
  const websiteId = "00000000-0000-4000-8000-000000000001";
  const from = (table: string) => {
    const data = table === "websites" ? { id: websiteId, normalized_domain: "example.com", notification_email: "a@example.com" } : table === "profiles" ? { first_name: "A", contact_email: "a@example.com" } : [];
    const builder = { select: () => builder, eq: () => builder, order: () => builder, limit: () => builder, maybeSingle: async () => ({ data }), then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data }).then(resolve) };
    return builder;
  };
  const response = await worker.fetch(new Request("https://example.invalid", { method: "POST", body: JSON.stringify({ websiteId, requestId: websiteId }) }), { userClaims: { id: "verified-actor" }, supabase: { from, rpc: async () => ({ data: [] }) }, supabaseAdmin: {} } as never);
  expect(response.status).toBe(status);
  expect(send).not.toHaveBeenCalled();
  expect(reserve.mock.calls[0].slice(1, 4)).toEqual(["verified-actor", websiteId, kind]);
});
