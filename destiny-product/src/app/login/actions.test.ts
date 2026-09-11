import { beforeEach, describe, expect, it, vi } from "vitest";
const { otp } = vi.hoisted(() => ({ otp: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ origin: "https://app.reboundseo.com" }) }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(url); } }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { signInWithOtp: otp } }) }));
import { sendMagicLink } from "./actions";
async function outcome(error: unknown, next = "/app/content?site=test") {
  otp.mockResolvedValue({ error });
  const form = new FormData();
  form.set("email", "  Sam@Example.com "); form.set("next", next);
  try { await sendMagicLink(form); } catch (e) { return new URL((e as Error).message, "https://app.reboundseo.com"); }
  throw new Error("Expected redirect");
}
describe("magic link recovery", () => {
  beforeEach(() => vi.clearAllMocks());
  it("explains the provider cooldown without claiming delivery or losing the destination", async () => {
    const url = await outcome({ code: "over_email_send_rate_limit", status: 429, message: "For security purposes, you can only request this after 42 seconds." });
    expect(url.searchParams.get("retry")).toBe("42");
    expect(url.searchParams.get("error")).toContain("Please wait");
    expect(url.searchParams.get("email")).toBe("sam@example.com");
    expect(url.searchParams.get("next")).toBe("/app/content?site=test");
    expect(url.searchParams.has("sent")).toBe(false);
    expect(otp).toHaveBeenCalledTimes(1);
  });
  it("preserves the destination after a successful send", async () => {
    const url = await outcome(null);
    expect(url.searchParams.get("sent")).toBe("1");
    expect(url.searchParams.get("next")).toBe("/app/content?site=test");
  });
  it("does not expose provider internals or accept external return destinations", async () => {
    const url = await outcome({ status: 500, message: "smtp secret diagnostic" }, "https://evil.example");
    expect(url.href).not.toContain("secret");
    expect(url.searchParams.get("next")).toBe("/app");
    expect(url.searchParams.get("email")).toBe("sam@example.com");
    expect(url.searchParams.has("sent")).toBe(false);
  });
});
