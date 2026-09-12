import { withSupabase } from "@supabase/server";
import Stripe from "stripe";
import { billingConfig } from "../_shared/billing/config.ts";
import { verifyStripeEventAsync } from "../_shared/billing/stripe-contract.ts";
import { reconcileStripeEvent } from "../_shared/billing/webhook-service.ts";
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export default {
  fetch: withSupabase({ auth: "none" }, async (request, context) => {
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
    const signature = request.headers.get("stripe-signature");
    if (!signature) return json({ error: "Signature required." }, 400);
    const config = billingConfig(name => Deno.env.get(name));
    if (!config) return json({ error: "Billing setup is not complete." }, 503);
    let event: Stripe.Event;
    try {
      event = await verifyStripeEventAsync(await request.text(), signature, config.webhookSecret, config.livemode);
    } catch { return json({ error: "Invalid signature or event." }, 400); }
    try {
      const stripe = new Stripe(config.key, { maxNetworkRetries: 1, timeout: 15_000 });
      await reconcileStripeEvent(context.supabaseAdmin, stripe, config, event);
      return json({ received: true });
    } catch { return json({ error: "Payment update could not be saved. Retry delivery." }, 503); }
  }),
};
