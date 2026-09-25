import type { SupabaseClient } from "npm:@supabase/supabase-js@2.111.0";

export type AuthEmailVerification = "verified" | "unverified" | "unavailable";

/** Resolve verification through the server-only Auth Admin API, never browser claims or user metadata. */
export async function authEmailVerification(admin: SupabaseClient, userId: string): Promise<AuthEmailVerification> {
  try {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error || !data.user) return "unavailable";
    return data.user.email_confirmed_at ? "verified" : "unverified";
  } catch {
    return "unavailable";
  }
}
