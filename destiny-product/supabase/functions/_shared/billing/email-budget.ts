import type { SupabaseClient } from "npm:@supabase/supabase-js@2.111.0";
import { reboundSeoSender } from "../email-sender.ts";
export async function reserveTransactionalEmail(admin: SupabaseClient, actorId: string, websiteId: string, kind: "welcome" | "progress", requestKey: string, recipient: string, env: (name: string) => string | undefined) {
  if (!env("RESEND_API_KEY")?.trim() || !reboundSeoSender(env("DESTINY_FROM_EMAIL"))) return { allowed: false, reason: "not_configured" };
  if (!/^\S+@\S+\.\S+$/.test(recipient) || recipient.toLowerCase().endsWith("@example.invalid")) return { allowed: false, reason: "invalid_recipient" };
  try {
    const { data, error } = await admin.rpc("reserve_transactional_email", { p_actor_id: actorId, p_website_id: websiteId, p_kind: kind, p_request_key: requestKey });
    if (error || !data) return { allowed: false, reason: "unavailable" };
    return { allowed: data.allowed === true && typeof data.id === "string", reason: String(data.reason ?? "unavailable") };
  } catch { return { allowed: false, reason: "unavailable" }; }
}
