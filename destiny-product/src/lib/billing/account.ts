import "server-only";
import { billingClient, type BillingAccountRow } from "@/lib/db/billing";
import { billingAccess, type SubscriptionState } from "./plans";

export function subscriptionState(row: BillingAccountRow): SubscriptionState {
  return { plan: row.plan ?? "", status: row.status, periodStart: row.period_start, periodEnd: row.period_end,
    paidThrough: row.paid_through, trialEnd: row.trial_end, cancelAtPeriodEnd: row.cancel_at_period_end };
}
export async function loadBillingAccount(ownerId: string) {
  const client = await billingClient(ownerId);
  const { data, error } = await client.account();
  if (error) return { available: false as const, account: null, access: billingAccess(null), used: {} as Record<string, number> };
  const access = billingAccess(data ? subscriptionState(data) : null);
  const since = data?.status === "trialing" ? data.trial_started_at : data?.period_start;
  const used: Record<string, number> = {};
  if (since && access.canRunPaidWork) {
    const { data: usage, error: usageError } = await client.usage();
    if (usageError) return { available: false as const, account: data, access, used };
    for (const row of usage ?? []) used[row.meter] = Number(row.used);
  }
  return { available: true as const, account: data, access, used };
}
