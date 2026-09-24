import type Stripe from "stripe";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.111.0";

export type StripeBillingIdentity = { ownerId: string; customerId: string | null; subscriptionId: string | null; livemode: boolean };
export type StripeDiscountSummary = {
  name: string; duration: "once" | "repeating" | "forever"; endsAt: string | null;
  percentOff: number | null; amountOffCents: number | null;
};
export type StripeBillingPrice = {
  currency: "usd"; catalogSubtotalCents: number; nextPaymentCents: number; nextPaymentAt: string;
  discounts: StripeDiscountSummary[];
};

const object = (value: unknown): Record<string, unknown> | null => value && typeof value === "object" ? value as Record<string, unknown> : null;
const id = (value: unknown) => typeof value === "string" ? value : typeof object(value)?.id === "string" ? object(value)!.id as string : null;
const cents = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= 1_000_000_000 ? Number(value) : null;
const iso = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? new Date(value * 1000).toISOString() : null;
const label = (value: unknown) => {
  const clean = typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, 80) : "";
  return clean || "Discount applied";
};
const percentage = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;

function discountSummary(value: unknown): StripeDiscountSummary | null {
  const discount = object(value);
  if (!discount || discount.deleted === true) return null;
  const coupon = object(object(discount.source)?.coupon);
  if (!coupon || coupon.deleted === true) return { name: "Discount applied", duration: "once", endsAt: null, percentOff: null, amountOffCents: null };
  const duration = ["once", "repeating", "forever"].includes(String(coupon.duration)) ? coupon.duration as StripeDiscountSummary["duration"] : "once";
  const amount = cents(coupon.amount_off);
  return {
    name: label(coupon.name), duration, endsAt: iso(discount.end), percentOff: percentage(coupon.percent_off),
    amountOffCents: coupon.currency === "usd" || coupon.currency == null ? amount : null,
  };
}

/** Read-only Stripe truth for the authenticated owner's mirrored customer and subscription. */
export async function stripeBillingPrice(stripe: Stripe, account: StripeBillingIdentity): Promise<StripeBillingPrice | null> {
  if (!account.customerId || !account.subscriptionId) return null;
  try {
    const customer = await stripe.customers.retrieve(account.customerId);
    if (customer.deleted || customer.id !== account.customerId || customer.livemode !== account.livemode || customer.metadata.rebound_owner_id !== account.ownerId) return null;
    const subscription = await stripe.subscriptions.retrieve(account.subscriptionId);
    if (subscription.id !== account.subscriptionId || id(subscription.customer) !== account.customerId || subscription.livemode !== account.livemode || ["canceled", "incomplete_expired"].includes(subscription.status)) return null;
    const invoice = await stripe.invoices.createPreview({ customer: account.customerId, subscription: account.subscriptionId, expand: ["discounts", "discounts.source.coupon"] });
    const subtotal = cents(invoice.subtotal), due = cents(invoice.amount_due), paymentAt = iso(invoice.period_end);
    if (id(invoice.customer) !== account.customerId || invoice.livemode !== account.livemode || invoice.currency !== "usd" || subtotal == null || due == null || !paymentAt) return null;
    return { currency: "usd", catalogSubtotalCents: subtotal, nextPaymentCents: due, nextPaymentAt: paymentAt,
      discounts: invoice.discounts.slice(0, 3).map(discountSummary).filter((item): item is StripeDiscountSummary => Boolean(item)) };
  } catch {
    return null;
  }
}

export async function stripeBillingPriceForOwner(admin: SupabaseClient, stripe: Stripe, ownerId: string, livemode: boolean) {
  const { data, error } = await admin.from("billing_accounts").select("stripe_customer_id,stripe_subscription_id,livemode")
    .eq("owner_id", ownerId).maybeSingle<{ stripe_customer_id: string | null; stripe_subscription_id: string | null; livemode: boolean }>();
  if (error || !data || data.livemode !== livemode) return null;
  return stripeBillingPrice(stripe, { ownerId, customerId: data.stripe_customer_id, subscriptionId: data.stripe_subscription_id, livemode });
}
