import Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BillingConfig } from "./config.ts";
import { plans, planById } from "./plans.ts";
import { checkoutParameters } from "./stripe-contract.ts";
import { BillingOperationError, saveStripeCustomer, withBillingOperation, assertBillingOperation } from "./store.ts";

export async function verifyBillingConfiguration(stripe: Stripe, config: BillingConfig) {
  const account = await stripe.accounts.retrieve();
  if (account.id !== config.accountId || (config.livemode && (!account.charges_enabled || !account.payouts_enabled))) throw new BillingOperationError("stripe_account_unavailable");
  for (const plan of plans) {
    const price = await stripe.prices.retrieve(config.priceIds[plan.id]);
    if (!price.active || price.livemode !== config.livemode || price.currency !== "usd" || price.unit_amount !== plan.monthlyCents || price.recurring?.interval !== "month" || price.recurring.interval_count !== 1 || price.type !== "recurring") throw new BillingOperationError("stripe_price_unavailable");
  }
  const portal = await stripe.billingPortal.configurations.retrieve(config.portalConfigurationId);
  if (!portal.active || portal.id !== config.portalConfigurationId || portal.livemode !== config.livemode) throw new BillingOperationError("stripe_portal_unavailable");
}
export async function paymentAction(admin: SupabaseClient, stripe: Stripe, config: BillingConfig, ownerId: string, action: "checkout" | "portal", requestedPlan?: unknown) {
  const plan = planById(requestedPlan);
  if (action === "checkout" && !plan) throw new BillingOperationError("invalid_plan", 400);
  return withBillingOperation(admin, ownerId, config.livemode, async (account, token) => {
    let customerId = account.stripe_customer_id;
    if (!customerId) {
      if (action === "portal") throw new BillingOperationError("no_subscription", 409);
      await assertBillingOperation(admin, ownerId, token);
      const customer = await stripe.customers.create({ metadata: { rebound_owner_id: ownerId } }, { idempotencyKey: `rebound-customer-${ownerId}` });
      if (customer.livemode !== config.livemode) throw new BillingOperationError("customer_mode_mismatch");
      await saveStripeCustomer(admin, ownerId, token, customer.id);
      customerId = customer.id;
    }
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted || customer.livemode !== config.livemode || customer.metadata.rebound_owner_id !== ownerId) throw new BillingOperationError("customer_owner_mismatch");
    if (action === "portal") {
      await assertBillingOperation(admin, ownerId, token);
      const session = await stripe.billingPortal.sessions.create({ customer: customerId, configuration: config.portalConfigurationId, return_url: `${config.origin}/account/billing` });
      return { url: session.url };
    }
    // Read Stripe, not just the webhook mirror, before offering another subscription.
    const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 });
    if (subscriptions.has_more || subscriptions.data.some(sub => !["canceled", "incomplete_expired"].includes(sub.status))) throw new BillingOperationError("subscription_exists", 409);
    const trialEligible = !account.trial_started_at && !subscriptions.data.some(sub => sub.trial_start !== null);
    const pending = await stripe.checkout.sessions.list({ customer: customerId, status: "open", limit: 100 });
    if (pending.has_more) throw new BillingOperationError("billing_busy", 409);
    for (const session of pending.data) {
      if (session.client_reference_id !== ownerId || session.mode !== "subscription") continue;
      const lines = await stripe.checkout.sessions.listLineItems(session.id, { limit: 2 });
      if (lines.data.length === 1 && !lines.has_more && lines.data[0].price?.id === config.priceIds[plan!.id] && session.metadata?.rebound_trial === String(trialEligible) && session.url) return { url: session.url };
      await assertBillingOperation(admin, ownerId, token);
      await stripe.checkout.sessions.expire(session.id);
    }
    await assertBillingOperation(admin, ownerId, token);
    const session = await stripe.checkout.sessions.create(checkoutParameters({ ownerId, customerId, plan: plan!.id, trialEligible, origin: config.origin, priceIds: config.priceIds }), { idempotencyKey: `rebound-checkout-${ownerId}-${token}` });
    if (!session.url || session.livemode !== config.livemode) throw new BillingOperationError("checkout_unavailable");
    return { url: session.url };
  });
}
