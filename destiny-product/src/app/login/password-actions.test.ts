import { beforeEach, describe, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({ signInWithPassword: vi.fn(), signUp: vi.fn(), resetPasswordForEmail: vi.fn(), getUser: vi.fn(), updateUser: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ origin: "https://app.reboundseo.com" }) }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(url); } }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }));
import { signInWithPassword, signUpWithPassword, requestPasswordReset, savePassword } from "./password-actions";

function form(extra: Record<string, string> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ email: " Sam@Yahoo.com ", password: "A long private password!", confirmation: "A long private password!", next: "/keywords?site=existing", ...extra })) data.set(key, value);
  return data;
}
async function outcome(action: (data: FormData) => Promise<never>, data = form()) {
  try { await action(data); } catch (e) { return new URL((e as Error).message, "https://app.reboundseo.com"); }
  throw new Error("Expected redirect");
}
describe("password authentication", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    auth.signInWithPassword.mockResolvedValue({ data: { session: { user: { id: "same-user" } } }, error: null });
    auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    auth.resetPasswordForEmail.mockResolvedValue({ error: null });
    auth.getUser.mockResolvedValue({ data: { user: { id: "same-user", email: "sam@yahoo.com" } }, error: null });
    auth.updateUser.mockResolvedValue({ error: null });
  });
  it("signs in using the password and preserves the requested website", async () => {
    expect((await outcome(signInWithPassword)).pathname).toBe("/keywords");
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "sam@yahoo.com", password: "A long private password!" });
    expect(auth.signUp).not.toHaveBeenCalled();
    expect(auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });
  it("does not leak credentials or provider internals in a failed login", async () => {
    auth.signInWithPassword.mockResolvedValue({ data: { session: null }, error: { message: "private diagnostic password", code: "invalid_credentials" } });
    const url = await outcome(signInWithPassword);
    expect(url.searchParams.get("error")).toContain("email or password");
    expect(url.href).not.toContain("private");
    expect(url.searchParams.get("email")).toBe("sam@yahoo.com");
    expect(url.searchParams.get("next")).toBe("/keywords?site=existing");
  });
  it("fails closed if the provider returns no session", async () => {
    auth.signInWithPassword.mockResolvedValue({ data: { session: null }, error: null });
    expect((await outcome(signInWithPassword)).pathname).toBe("/login");
  });
  it("rejects malformed email and missing password without a provider request", async () => {
    await outcome(signInWithPassword, form({ email: "bad", password: "" }));
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });
  it("rejects external destinations", async () => {
    expect((await outcome(signInWithPassword, form({ next: "//attacker.example" }))).pathname).toBe("/app");
  });
  it("keeps signup pending until the provider confirms email", async () => {
    const url = await outcome(signUpWithPassword);
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("notice")).toBe("confirm");
    expect(auth.signUp).toHaveBeenCalledWith(expect.objectContaining({ email: "sam@yahoo.com", options: { emailRedirectTo: "https://app.reboundseo.com/auth/confirm?next=%2Fkeywords%3Fsite%3Dexisting" } }));
  });
  it("prevents weak or mismatched new passwords", async () => {
    await outcome(signUpWithPassword, form({ password: "short", confirmation: "short" }));
    await outcome(savePassword, form({ confirmation: "different" }));
    expect(auth.signUp).not.toHaveBeenCalled();
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
  it("uses one-time password recovery and returns through the existing callback", async () => {
    const url = await outcome(requestPasswordReset);
    expect(url.searchParams.get("notice")).toBe("recovery");
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("sam@yahoo.com", { redirectTo: "https://app.reboundseo.com/auth/confirm?next=%2Faccount%2Fpassword%3Fnext%3D%252Fkeywords%253Fsite%253Dexisting" });
  });
  it("explains recovery rate limits without exposing the provider error", async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: { code: "over_email_send_rate_limit", status: 429, message: "secret" } });
    const url = await outcome(requestPasswordReset);
    expect(url.searchParams.get("error")).toContain("wait");
    expect(url.searchParams.has("notice")).toBe(false);
    expect(url.href).not.toContain("secret");
  });
  it("never sets a password from an unauthenticated or invalid session", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await outcome(savePassword)).pathname).toBe("/login");
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
  it("sets the password for the validated current user only, ignoring supplied identity", async () => {
    const url = await outcome(savePassword, form({ userId: "other-user", email: "other@example.com" }));
    expect(auth.getUser).toHaveBeenCalledTimes(1);
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "A long private password!" });
    expect(url.searchParams.get("saved")).toBe("1");
    expect(url.href).not.toContain("private");
  });
  it("requires a fresh login when the provider requires reauthentication", async () => {
    auth.updateUser.mockResolvedValue({ error: { code: "reauthentication_needed", message: "internal" } });
    const url = await outcome(savePassword);
    expect(url.searchParams.get("error")).toContain("Sign in again");
    expect(url.searchParams.has("saved")).toBe(false);
  });
});
