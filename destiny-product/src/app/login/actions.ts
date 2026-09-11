"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeInternalPath } from "@/lib/auth/redirect";
import { siteOrigin } from "@/lib/auth/site-url";
import { createClient } from "@/lib/supabase/server";

export async function sendMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = safeInternalPath(formData.get("next"));
  const result = new URLSearchParams({ email, next, attempt: crypto.randomUUID() });
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 320) {
    result.set("error", "Enter a valid email address.");
    redirect(`/login?${result}`);
  }

  const headerStore = await headers();
  const origin = siteOrigin(process.env.NEXT_PUBLIC_SITE_URL, headerStore.get("origin"));
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    const limited = error.code === "over_email_send_rate_limit" || error.status === 429;
    if (limited) {
      const seconds = Number(error.message.match(/after (\d+) seconds/i)?.[1] ?? 60);
      result.set("retry", String(Math.min(3600, Math.max(1, seconds))));
      result.set("error", "Please wait before requesting another sign-in link. Check your inbox and spam folder for a recent Rebound SEO email, or retry when the countdown ends.");
    } else {
      result.set("error", "We could not send the sign-in link. Please try again shortly using the same email.");
    }
    redirect(`/login?${result}`);
  }
  result.set("sent", "1");
  redirect(`/login?${result}`);
}
