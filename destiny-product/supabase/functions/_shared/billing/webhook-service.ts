import type Stripe from "stripe";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.111.0";
import type { BillingConfig } from "./config.ts";
import { BillingOperationError, withBillingOperation } from "./store.ts";
import { validateSubscription } from "./stripe-contract.ts";
const supported = new Set([
  "checkout.session.completed", "customer.subscription.created", "customer.subscription.updated",
  "customer.subscription.deleted", "customer.subscription.paused", "customer.subscription.resumed",
  "customer.subscription.trial_will_end", "invoice.paid", "invoice.payment_failed", "invoice.payment_action_required",
]);
/** Caller must verify the raw-body signature before invoking this service. */
export async function reconcileStripeEvent(admin: SupabaseClient, stripe: Stripe, config: BillingConfig, event: Stripe.Event): Promise<void> {
  if (event.livemode !== config.livemode || event.account) throw new BillingOperationError("event_account_mismatch");
  if (!supported.has(event.type)) return;
  const object = event.data.object as { customer?: string | { id: string } | null };
  const customerId = typeof object.customer === "string" ? object.customer : object.customer?.id;
  if (!customerId) return;
  // Only the server-created customer mapping determines ownership, never webhook metadata.
  const { data: owner, error } = await admin.from("billing_accounts").select("owner_id").eq("stripe_customer_id", customerId).maybeSingle();
  if (error) throw new BillingOperationError("account_unavailable");
  if (!owner) return;
  const account = await stripe.accounts.retrieve();
  if (account.id !== config.accountId) throw new BillingOperationError("stripe_account_mismatch");
  await withBillingOperation(admin, owner.owner_id, config.livemode, async (billing, token) => {
    if (billing.stripe_customer_id !== customerId) throw new BillingOperationError("customer_mismatch");
    const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 });
    if (subscriptions.has_more) throw new BillingOperationError("subscription_history_unavailable");
    const current = subscriptions.data.filter(item => !["canceled", "incomplete_expired"].includes(item.status));
    if (current.length > 1) throw new BillingOperationError("subscription_conflict");
    const selected = current[0] ?? [...subscriptions.data].sort((a, b) => b.created - a.created)[0];
    if (!selected) throw new BillingOperationError("subscription_unavailable");
    const subscription = await stripe.subscriptions.retrieve(selected.id, { expand: ["latest_invoice"] });
    const state = validateSubscription(subscription, { customerId, livemode: config.livemode, priceIds: config.priceIds });
    const { error: saveError } = await admin.rpc("apply_billing_snapshot", {
      p_owner_id: owner.owner_id, p_token: token, p_event_id: event.id, p_event_type: event.type,
      p_livemode: config.livemode,
      p_snapshot: { ...state, id: subscription.id, customer: customerId, trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null },
    });
    if (saveError) throw new BillingOperationError("subscription_save_failed");
  });
}
