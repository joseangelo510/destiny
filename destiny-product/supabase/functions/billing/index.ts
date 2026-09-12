import { withSupabase } from "@supabase/server";
import Stripe from "stripe";
import { billingConfig } from "../_shared/billing/config.ts";
import { paymentAction, verifyBillingConfiguration } from "../_shared/billing/payment-service.ts";
import { BillingOperationError } from "../_shared/billing/store.ts";
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
export default {
  fetch: withSupabase({ auth: "user" }, async (request, context) => {
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
    const ownerId = context.userClaims?.id;
    if (!ownerId) return json({ error: "Sign in again to continue." }, 401);
    let body: { action?: unknown; plan?: unknown };
    try { body = await request.json(); } catch { return json({ error: "Invalid request." }, 400); }
    if (!["status", "checkout", "portal"].includes(String(body.action))) return json({ error: "Invalid billing action." }, 400);
    const config = billingConfig(name => Deno.env.get(name));
    if (!config) return body.action === "status" ? json({ ready: false }) : json({ error: "Billing setup is not complete." }, 503);
    try {
      const { data, error } = await context.supabaseAdmin.auth.admin.getUserById(ownerId);
      if (error || !data.user?.email_confirmed_at) return json({ error: "Verify your sign-in email before starting a subscription." }, 403);
      const stripe = new Stripe(config.key, { maxNetworkRetries: 1, timeout: 15_000 });
      await verifyBillingConfiguration(stripe, config);
      if (body.action === "status") return json({ ready: true, mode: config.livemode ? "live" : "test" });
      return json(await paymentAction(context.supabaseAdmin, stripe, config, ownerId, body.action as "checkout" | "portal", body.plan));
    } catch (cause) {
      const code = cause instanceof BillingOperationError ? cause.code : "billing_unavailable";
      return json({ error: "We couldn't complete billing. Please try again shortly.", code }, cause instanceof BillingOperationError ? cause.status : 503);
    }
  }),
};
