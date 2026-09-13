import { reserveTransactionalEmail } from "../_shared/billing/email-budget.ts";
import { withSupabase } from "@supabase/server";
import { notificationRecipient } from "../notification-recipient.ts";
import { sendWelcomeEmail } from "./email.ts";

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export default {
  fetch: withSupabase({ auth: "user" }, async (request, context) => {
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
    const body = await request.json().catch(() => ({})) as { websiteId?: unknown };
    if (typeof body.websiteId !== "string" || !body.websiteId) {
      return json({ error: "A saved website is required." }, 400);
    }

    const userId = context.userClaims?.id;
    if (!userId) return json({ error: "Sign in again to continue." }, 401);

    const [{ data: profile }, { data: website }] = await Promise.all([
      context.supabase
        .from("profiles")
        .select("first_name,contact_email")
        .eq("id", userId)
        .maybeSingle(),
      context.supabase
        .from("websites")
        .select("id,normalized_domain,notification_email")
        .eq("id", body.websiteId)
        .maybeSingle(),
    ]);
    if (!profile || !website) return json({ error: "You do not have access to that website." }, 403);

    const recipient = notificationRecipient(website.notification_email, profile.contact_email);
    const budget = await reserveTransactionalEmail(context.supabaseAdmin, userId, website.id, "welcome", website.id, recipient, name => Deno.env.get(name));
    if (!budget.allowed) return json({ delivery: { status: "skipped", reason: budget.reason === "duplicate" || budget.reason === "limit_reached" ? "Welcome email was already requested. Your saved website remains available." : "Welcome email is unavailable. Your saved website remains available." } });
    const delivery = await sendWelcomeEmail({
      userId,
      websiteId: website.id,
      firstName: profile.first_name,
      recipient,
      domain: website.normalized_domain,
    }).catch((cause) => ({
      status: "failed" as const,
      reason: cause instanceof Error ? cause.message.slice(0, 300) : "Email delivery failed.",
    }));

    if (delivery.status === "accepted") {
      console.log("Welcome email accepted", { websiteId: website.id, messageId: delivery.messageId ?? null });
    } else {
      console.error("Welcome email not accepted", { websiteId: website.id, status: delivery.status, reason: delivery.reason ?? "Unknown reason" });
    }

    return json({ delivery });
  }),
};
