import type { Metadata } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import { WorkspaceShell } from "@/components/workspace-shell";
import { BillingNotice, PricingPlans } from "@/components/billing/pricing-plans";
import { getWorkspaceContext } from "@/lib/workspace-context";
import { loadBillingAccount } from "@/lib/billing/account";
import { meterLabels, planById, type Meter } from "@/lib/billing/plans";
import styles from "@/components/billing/pricing.module.css";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Plans and billing — Rebound SEO", description: "Your subscription, usage and payment settings." };
export default async function BillingPage() {
  const context = await getWorkspaceContext();
  const billing = await loadBillingAccount(context.supabase as unknown as SupabaseClient, context.userId);
  const { account, access } = billing;
  const plan = planById(account?.plan);
  // Checkout is deliberately gated until end-to-end provider configuration is verified.
  const checkoutReady = false;
  return <WorkspaceShell active="/account/billing" eyebrow="Your subscription" title="Plans and billing" description="See your allowance, choose a plan and manage payments in one place.">
    <section className={styles.summary} aria-label="Current subscription">
      <h2>{plan ? `${plan.name}${account?.status === "trialing" ? " trial" : ""}` : "Your account"}</h2>
      {!billing.available ? <p role="status">We couldn’t load billing information. Your saved work is still available. Please try again shortly.</p>
        : <><p>{account?.status === "trialing" ? `Trial ends ${new Date(account.trial_end!).toLocaleDateString("en-US", { dateStyle: "long", timeZone: "UTC" })} (UTC).` : account?.status === "active" ? "Monthly subscription" : "No active paid subscription"}</p>
          {account?.cancel_at_period_end && account.period_end && <p>Your subscription is set to end on {new Date(account.period_end).toLocaleDateString("en-US", { timeZone: "UTC" })}. It will not renew.</p>}
          {access.reason !== "available" && <BillingNotice reason={access.reason} />}
          {access.limits && <><p>Used this period. All sites share these allowances.</p><dl className={styles.usage}>{(Object.keys(meterLabels) as (keyof typeof meterLabels)[]).filter(key => key !== "websites" && key !== "trackedTargets").map(key => <div key={key}><dt>{meterLabels[key]}</dt><dd>{billing.used[key as Meter] ?? 0} / {access.limits![key]}</dd></div>)}</dl></>}
        </>}
    </section>
    <PricingPlans checkoutReady={checkoutReady} trialEligible={!account?.trial_started_at} currentPlan={plan?.id} hasSubscription={Boolean(account?.stripe_subscription_id && !["canceled", "incomplete_expired"].includes(account.status))} />
  </WorkspaceShell>;
}
