import Stripe from "stripe";
import { planById, plans, type PlanId, type SubscriptionState } from "./plans";
export type StripePrices = Record<PlanId, string>;
export function checkoutParameters(input: { ownerId: string; customerId: string; plan: PlanId; trialEligible: boolean; origin: string; priceIds: StripePrices }): Stripe.Checkout.SessionCreateParams {
  const plan = planById(input.plan);
  if (!plan || !input.priceIds[plan.id]) throw new Error("Unknown subscription plan");
  const origin = new URL(input.origin).origin;
  return {
    mode: "subscription", customer: input.customerId, client_reference_id: input.ownerId,
    payment_method_collection: "always", payment_method_types: ["card"],
    line_items: [{ price: input.priceIds[plan.id], quantity: 1 }],
    success_url: `${origin}/account/billing?checkout=returned`, cancel_url: `${origin}/account/billing?checkout=canceled`,
    subscription_data: { metadata: { rebound_owner_id: input.ownerId }, ...(input.trialEligible ? { trial_period_days: 7, trial_settings: { end_behavior: { missing_payment_method: "cancel" as const } } } : {}) },
    custom_text: { submit: { message: input.trialEligible ? `7-day trial, then $${plan.monthlyCents / 100}/month plus applicable tax. Cancel before the trial ends to avoid a charge. Trial allowances are smaller than paid allowances.` : `$${plan.monthlyCents / 100}/month plus applicable tax. Cancel renewal in your billing settings.` } },
  };
}
const iso = (seconds: number | null | undefined) => typeof seconds === "number" && Number.isFinite(seconds) ? new Date(seconds * 1000).toISOString() : null;
export function validateSubscription(subscription: Stripe.Subscription, expected: { customerId: string; livemode: boolean; priceIds: StripePrices }): SubscriptionState {
  const customer = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  if (customer !== expected.customerId || subscription.livemode !== expected.livemode) throw new Error("Stripe account or mode mismatch");
  if (subscription.items.data.length !== 1 || subscription.items.has_more) throw new Error("Unexpected subscription items");
  const item = subscription.items.data[0];
  const plan = plans.find(plan => expected.priceIds[plan.id] === item.price.id);
  if (!plan || item.quantity !== 1 || item.price.unit_amount !== plan.monthlyCents || item.price.currency !== "usd" || item.price.recurring?.interval !== "month" || item.price.recurring.interval_count !== 1) throw new Error("Unexpected subscription price");
  const invoice = subscription.latest_invoice && typeof subscription.latest_invoice === "object" ? subscription.latest_invoice : null;
  // Only the recurring line for this exact item can establish paid time.
  // A paid trial invoice, unrelated invoice or browser redirect cannot unlock a month.
  const line = invoice?.status === "paid" ? invoice.lines.data.find(line => line.parent?.subscription_item_details?.subscription_item === item.id && line.pricing?.price_details?.price === item.price.id && !line.parent.subscription_item_details.proration) : undefined;
  return {
    plan: plan.id, status: subscription.pause_collection ? "paused" : subscription.status,
    periodStart: iso(item.current_period_start), periodEnd: iso(item.current_period_end),
    paidThrough: iso(line?.period.end), trialEnd: iso(subscription.trial_end), cancelAtPeriodEnd: subscription.cancel_at_period_end,
  };
}
export function verifyStripeEvent(rawBody: string, signature: string, secret: string, livemode: boolean): Stripe.Event {
  if (!signature || !secret) throw new Error("Stripe signature configuration missing");
  const stripe = new Stripe("sk_unused_signature_verification");
  const event = stripe.webhooks.constructEvent(rawBody, signature, secret, 300);
  if (event.livemode !== livemode) throw new Error("Stripe event mode mismatch");
  return event;
}
