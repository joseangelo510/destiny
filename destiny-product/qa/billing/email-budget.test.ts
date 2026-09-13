import { expect, it, vi } from "vitest";
import { reserveTransactionalEmail } from "../../supabase/functions/_shared/billing/email-budget";
const configured = (name: string) => name === "DESTINY_FROM_EMAIL" ? "Rebound SEO <hello@reboundseo.com>" : "fixture";
it("does not reserve email attempts without provider configuration or a deliverable recipient", async () => {
  const rpc = vi.fn();
  for (const [recipient, env] of [["a@example.com", () => undefined], ["qa@example.invalid", configured], ["invalid", configured]] as const) {
    expect((await reserveTransactionalEmail({ rpc } as never, "viewer", "site", "progress", "key", recipient, env)).allowed).toBe(false);
  }
  expect(rpc).not.toHaveBeenCalled();
});
it("passes verified actor/site scope and rejects unavailable or denied budget", async () => {
  const rpc = vi.fn(async () => ({ data: { allowed: false, reason: "limit_reached" }, error: null }));
  expect(await reserveTransactionalEmail({ rpc } as never, "viewer", "site", "progress", "key", "a@example.com", configured)).toMatchObject({ allowed: false, reason: "limit_reached" });
  expect(rpc).toHaveBeenCalledWith("reserve_transactional_email", { p_actor_id: "viewer", p_website_id: "site", p_kind: "progress", p_request_key: "key" });
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
