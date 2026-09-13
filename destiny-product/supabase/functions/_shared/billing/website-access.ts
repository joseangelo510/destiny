import type { SupabaseClient } from "npm:@supabase/supabase-js@2.111.0";
import { billingAccess } from "./plans.ts";
export async function websitePaidAccess(admin: SupabaseClient, websiteId: string, now = Date.now()) {
  const { data: website, error: websiteError } = await admin.from("websites").select("organizations!inner(owner_id)").eq("id", websiteId).maybeSingle();
  const organization = Array.isArray(website?.organizations) ? website.organizations[0] : website?.organizations;
  const ownerId = organization?.owner_id;
  if (websiteError || typeof ownerId !== "string") return null;
  const { data: account, error } = await admin.from("billing_accounts").select("plan,status,period_start,period_end,paid_through,trial_end,cancel_at_period_end").eq("owner_id", ownerId).maybeSingle();
  if (error || !account) return null;
  const access = billingAccess({ plan: account.plan ?? "", status: account.status, periodStart: account.period_start, periodEnd: account.period_end, paidThrough: account.paid_through, trialEnd: account.trial_end, cancelAtPeriodEnd: account.cancel_at_period_end }, now);
  if (!access.canRunPaidWork || !access.limits) return null;
  const { data: managed, error: selectionError } = await admin.rpc("is_billing_website_managed", { p_owner_id: ownerId, p_website_id: websiteId });
  if (selectionError || managed !== true) return null;
  return { ownerId, limits: access.limits, trial: account.status === "trialing" };
}
