import { expect, it, vi } from "vitest";
import { reserveTransactionalEmail } from "../../supabase/functions/_shared/billing/email-budget";
const configured = (name: string) => name === "DESTINY_FROM_EMAIL" ? "Rebound SEO <hello@reboundseo.com>" : "fixture";
it("does not reserve email attempts without provider configuration or a deliverable recipient", async () => {
  const rpc = vi.fn(), getUserById = vi.fn();
  for (const [recipient, env] of [["a@example.com", () => undefined], ["qa@example.invalid", configured], ["invalid", configured]] as const) {
    expect((await reserveTransactionalEmail({ rpc, auth: { admin: { getUserById } } } as never, "viewer", "site", "progress", "key", recipient, env)).allowed).toBe(false);
  }
  expect(rpc).not.toHaveBeenCalled();
  expect(getUserById).not.toHaveBeenCalled();
});
it("passes verified actor/site scope and rejects unavailable or denied budget", async () => {
  const rpc = vi.fn(async () => ({ data: { allowed: false, reason: "limit_reached" }, error: null }));
  const getUserById = vi.fn(async () => ({ data: { user: { email_confirmed_at: "2026-09-24T00:00:00Z" } }, error: null }));
  expect(await reserveTransactionalEmail({ rpc, auth: { admin: { getUserById } } } as never, "viewer", "site", "progress", "key", "a@example.com", configured)).toMatchObject({ allowed: false, reason: "limit_reached" });
  expect(rpc).toHaveBeenCalledWith("reserve_transactional_email_v2", { p_actor_id: "viewer", p_website_id: "site", p_kind: "progress", p_request_key: "key", p_actor_verified: true });
});

it.each([
  { result: { data: { user: { email_confirmed_at: null } }, error: null }, reason: "verification_required" },
  { result: { data: { user: null }, error: { message: "Auth unavailable" } }, reason: "unavailable" },
])("does not reserve email usage when actor verification is incomplete", async ({ result, reason }) => {
  const rpc = vi.fn();
  const getUserById = vi.fn(async () => result);
  expect(await reserveTransactionalEmail({ rpc, auth: { admin: { getUserById } } } as never, "viewer", "site", "progress", "key", "a@example.com", configured)).toMatchObject({ allowed: false, reason });
  expect(rpc).not.toHaveBeenCalled();
});

it("welcome copy confirms saved setup without claiming that an audit has started", async () => {
  const { sendWelcomeEmail } = await import("../../supabase/functions/send-welcome/email");
  vi.stubGlobal("Deno", { env: { get: configured } });
  const fetcher = vi.fn(async () => Response.json({ id: "fixture-email" }));
  vi.stubGlobal("fetch", fetcher);
  try {
    const delivered = await sendWelcomeEmail({ userId: "owner", websiteId: "site", firstName: "A", recipient: "a@example.com", domain: "example.com" });
    expect(delivered).toEqual({ status: "accepted", messageId: "fixture-email" });
    const body = JSON.parse((fetcher.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    expect(body.text).toContain("start any available audit");
    expect(body.text).not.toContain("We are preparing");
    expect(body.html).not.toContain("We are preparing");
  } finally { vi.unstubAllGlobals(); }
});
