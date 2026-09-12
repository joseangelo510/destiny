import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { billingAccess, type SubscriptionState } from "./plans";

type AccountRow = {
  owner_id: string; stripe_customer_id: string | null; stripe_subscription_id: string | null;
  plan: string | null; status: string; period_start: string | null; period_end: string | null;
  paid_through: string | null; trial_started_at: string | null; trial_end: string | null; cancel_at_period_end: boolean;
};
export function subscriptionState(row: AccountRow): SubscriptionState {
  return { plan: row.plan ?? "", status: row.status, periodStart: row.period_start, periodEnd: row.period_end,
    paidThrough: row.paid_through, trialEnd: row.trial_end, cancelAtPeriodEnd: row.cancel_at_period_end };
}
export async function loadBillingAccount(client: SupabaseClient, ownerId: string) {
  const { data, error } = await client.from("billing_accounts").select("owner_id,stripe_customer_id,stripe_subscription_id,plan,status,period_start,period_end,paid_through,trial_started_at,trial_end,cancel_at_period_end").eq("owner_id", ownerId).maybeSingle<AccountRow>();
  if (error) return { available: false as const, account: null, access: billingAccess(null), used: {} as Record<string, number> };
  const access = billingAccess(data ? subscriptionState(data) : null);
  const since = data?.status === "trialing" ? data.trial_started_at : data?.period_start;
  const used: Record<string, number> = {};
  if (since && access.canRunPaidWork) {
    const { data: usage, error: usageError } = await client.rpc("billing_period_usage");
    if (usageError) return { available: false as const, account: data, access, used };
    for (const row of usage ?? []) used[row.meter] = Number(row.used);
  }
  return { available: true as const, account: data, access, used };
}
