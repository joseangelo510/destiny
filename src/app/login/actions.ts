"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeInternalPath } from "@/lib/auth/redirect";
import { siteOrigin } from "@/lib/auth/site-url";
import { createClient } from "@/lib/supabase/server";

export async function sendMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = safeInternalPath(formData.get("next"));
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 320) {
    redirect(`/login?error=${encodeURIComponent("Enter a valid email address.")}`);
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
    redirect(`/login?error=${encodeURIComponent("We could not send the sign-in link. Try again.")}`);
  }
  redirect(`/login?sent=1&email=${encodeURIComponent(email)}`);
}
