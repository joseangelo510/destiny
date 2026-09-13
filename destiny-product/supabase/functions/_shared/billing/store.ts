import type { SupabaseClient } from "npm:@supabase/supabase-js@2.111.0";
export type PaymentAccount = { owner_id: string; stripe_customer_id: string | null; stripe_subscription_id: string | null; trial_started_at: string | null; livemode: boolean };
export class BillingOperationError extends Error {
  constructor(public readonly code: string, public readonly status = 503) { super(code); }
}
export async function withBillingOperation<T>(admin: SupabaseClient, ownerId: string, livemode: boolean, run: (account: PaymentAccount, token: string) => Promise<T>): Promise<T> {
  const { data: lock, error } = await admin.rpc("claim_billing_operation", { p_owner_id: ownerId, p_livemode: livemode });
  if (error) throw new BillingOperationError("account_unavailable");
  if (!lock?.acquired || typeof lock.token !== "string") throw new BillingOperationError("billing_busy", 409);
  try {
    const { data: account, error: readError } = await admin.from("billing_accounts").select("owner_id,stripe_customer_id,stripe_subscription_id,trial_started_at,livemode").eq("owner_id", ownerId).single<PaymentAccount>();
    if (readError || !account || account.livemode !== livemode) throw new BillingOperationError("account_unavailable");
    return await run(account, lock.token);
  } finally {
    await admin.rpc("release_billing_operation", { p_owner_id: ownerId, p_token: lock.token });
  }
}
export async function saveStripeCustomer(admin: SupabaseClient, ownerId: string, token: string, customerId: string) {
  const { data, error } = await admin.from("billing_accounts").update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() }).eq("owner_id", ownerId).eq("operation_token", token).gt("operation_expires_at", new Date().toISOString()).is("stripe_customer_id", null).select("owner_id").maybeSingle();
  if (error || !data) throw new BillingOperationError("billing_busy", 409);
}

/** Leave enough lease time for the SDK's bounded timeout and one retry. */
export async function assertBillingOperation(admin: SupabaseClient, ownerId: string, token: string) {
  const { data, error } = await admin.from("billing_accounts").select("owner_id").eq("owner_id", ownerId).eq("operation_token", token).gt("operation_expires_at", new Date(Date.now() + 45_000).toISOString()).maybeSingle();
  if (error || !data) throw new BillingOperationError("billing_busy", 409);
}
