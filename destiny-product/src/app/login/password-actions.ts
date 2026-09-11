"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeInternalPath } from "@/lib/auth/redirect";
import { siteOrigin } from "@/lib/auth/site-url";
import { createClient } from "@/lib/supabase/server";

function fields(form: FormData) {
  return {
    email: String(form.get("email") ?? "").trim().toLowerCase(),
    password: String(form.get("password") ?? ""),
    next: safeInternalPath(form.get("next")),
  };
}
function validEmail(email: string) { return email.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function newPasswordError(password: string, confirmation: FormDataEntryValue | null) {
  if (password.length < 12 || password.length > 128) return "Use a password between 12 and 128 characters.";
  if (password !== confirmation) return "The passwords do not match.";
  return null;
}
function loginResult(email: string, next: string, mode: string, details: Record<string, string>): never {
  redirect(`/login?${new URLSearchParams({ email, next, mode, ...details })}`);
}
async function callback(next: string) {
  const origin = siteOrigin(process.env.NEXT_PUBLIC_SITE_URL, (await headers()).get("origin"));
  return `${origin}/auth/confirm?next=${encodeURIComponent(next)}`;
}
function limited(error: { code?: string; status?: number } | null) {
  return error?.status === 429 || error?.code === "over_email_send_rate_limit";
}

export async function signInWithPassword(form: FormData): Promise<never> {
  const { email, password, next } = fields(form);
  if (!validEmail(email) || !password || password.length > 1024) loginResult(email, next, "password", { error: "Enter your email and password." });
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    const message = limited(error) ? "Too many attempts. Please wait a moment before trying again."
      : error?.code === "email_not_confirmed" ? "Confirm your email once before signing in. Check your inbox and spam folder."
      : "We could not sign you in with that email or password. Try again, or choose Set or reset password.";
    loginResult(email, next, "password", { error: message });
  }
  redirect(next);
}

export async function signUpWithPassword(form: FormData): Promise<never> {
  const { email, password, next } = fields(form);
  const validation = !validEmail(email) ? "Enter a valid email address." : newPasswordError(password, form.get("confirmation"));
  if (validation) loginResult(email, next, "signup", { error: validation });
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: await callback(next) } });
  if (error) loginResult(email, next, "signup", { error: limited(error)
    ? "Please wait before requesting another confirmation. Check your inbox and spam folder."
    : "We could not create the account. Try a different password, or sign in if you already have an account." });
  if (data.session) redirect(next);
  loginResult(email, next, "password", { notice: "confirm" });
}

export async function requestPasswordReset(form: FormData): Promise<never> {
  const { email, next } = fields(form);
  if (!validEmail(email)) loginResult(email, next, "reset", { error: "Enter a valid email address." });
  const supabase = await createClient();
  const destination = `/account/password?${new URLSearchParams({ next })}`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: await callback(destination) });
  if (error) loginResult(email, next, "reset", { error: limited(error)
    ? "Please wait before requesting another recovery email. Check your inbox and spam folder for the latest message."
    : "We could not request the recovery email. Please try again shortly." });
  loginResult(email, next, "password", { notice: "recovery" });
}

export async function savePassword(form: FormData): Promise<never> {
  const { password, next } = fields(form);
  const destination = `/account/password?${new URLSearchParams({ next })}`;
  const supabase = await createClient();
  const { data, error: sessionError } = await supabase.auth.getUser();
  if (sessionError || !data.user) loginResult("", destination, "password", { error: "Sign in first to set your password, or use Set or reset password." });
  const validation = newPasswordError(password, form.get("confirmation"));
  if (validation) redirect(`${destination}&${new URLSearchParams({ error: validation })}`);
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    const message = error.code === "reauthentication_needed" || error.code === "reauthentication_not_valid"
      ? "Sign in again or use password recovery, then set your password from the new session."
      : error.code === "same_password" ? "Choose a password different from your current password."
      : "We could not save that password. Choose a strong, unique password and try again.";
    redirect(`${destination}&${new URLSearchParams({ error: message })}`);
  }
  redirect(`${destination}&saved=1`);
}
