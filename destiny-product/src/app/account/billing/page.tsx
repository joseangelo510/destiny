import type { Metadata } from "next";
import { WorkspaceShell } from "@/components/workspace-shell";
import { BillingNotice, PricingPlans } from "@/components/billing/pricing-plans";
import { getWorkspaceContext } from "@/lib/workspace-context";
import { loadBillingAccount } from "@/lib/billing/account";
import { meterLabels, planById, type Meter } from "@/lib/billing/plans";
import styles from "@/components/billing/pricing.module.css";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Plans and billing — Rebound SEO", description: "Your subscription, usage and payment settings." };
export default async function BillingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const context = await getWorkspaceContext();
  const billing = await loadBillingAccount(context.userId);
  const { account, access } = billing;
  const plan = planById(account?.plan);
  const checkoutReady = billing.available && billing.checkoutReady;
  return <WorkspaceShell active="/account/billing" eyebrow="Your subscription" title="Plans and billing" description="See your allowance, choose a plan and manage payments in one place.">
    {query.billing_error === "unavailable" && <p className={styles.notice} role="alert">We couldn’t open billing. Please try again shortly. No new access has been granted.</p>}
    {query.checkout === "returned" && <p className={styles.notice} role="status">You’re back from Checkout. Your subscription status below updates when Stripe confirms the trial or payment. If it hasn’t updated yet, refresh this page shortly.</p>}
    {query.checkout === "canceled" && <p className={styles.notice} role="status">Checkout was canceled. You can choose a plan when you’re ready.</p>}
    {billing.mode === "test" && <p className={styles.notice} role="status">Test billing environment. Use Stripe test payment details only.</p>}
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
