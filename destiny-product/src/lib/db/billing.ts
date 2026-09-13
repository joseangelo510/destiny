import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type BillingAccountRow = {
  owner_id: string; stripe_customer_id: string | null; stripe_subscription_id: string | null;
  plan: string | null; status: string; period_start: string | null; period_end: string | null;
  paid_through: string | null; trial_started_at: string | null; trial_end: string | null; cancel_at_period_end: boolean;
};
/** Billing scope is the authenticated owner, across all organizations they own. */
export async function billingClient(ownerId: string) {
  const client = await createClient();
  const { data } = await client.auth.getClaims();
  if (!ownerId || data?.claims?.sub !== ownerId) throw new Error("Billing owner authentication required");
  const runtime = client as unknown as SupabaseClient;
  return {
    account: () => runtime.from("billing_accounts").select("owner_id,stripe_customer_id,stripe_subscription_id,plan,status,period_start,period_end,paid_through,trial_started_at,trial_end,cancel_at_period_end").eq("owner_id", ownerId).maybeSingle<BillingAccountRow>(),
    usage: () => runtime.rpc("billing_period_usage"),
    status: () => client.functions.invoke("billing", { body: { action: "status" } }),
  };
}

/** No service key: the Edge Function receives and verifies the caller's JWT. */
export async function billingSessionClient() {
  const client = await createClient();
  return {
    async getClaims() {
      const { data } = await client.auth.getClaims();
      return typeof data?.claims?.sub === "string" ? data.claims.sub : null;
    },
    invoke: (body: { action: "checkout" | "portal" | "status" | "website_access" | "sites" | "select_sites"; plan?: string; websiteId?: string; websiteIds?: string[] }) => client.functions.invoke("billing", { body }),
  };
}

export type BillingWorkerClient = Pick<SupabaseClient, "functions">;
