import React from "react";
import Link from "next/link";
import { meterLabels, plans, type AccessReason, type PlanId, type UsageLimits } from "@/lib/billing/plans";
import styles from "./pricing.module.css";

type PricingProps = { checkoutReady: boolean; trialEligible: boolean; currentPlan?: PlanId; publicPage?: boolean; hasSubscription?: boolean };
export function PricingPlans({ checkoutReady, trialEligible, currentPlan, publicPage = false, hasSubscription = false }: PricingProps) {
  const Heading = publicPage ? "h1" : "h2";
  return <section className={styles.offer} aria-label="Subscription plans">
    <div className={styles.intro}>
      <p className={styles.eyebrow}>Your next chapter</p>
      <Heading>Make room for <em>steady growth.</em></Heading>
      <p>One complete SEO workflow. Choose the capacity that fits your business.</p>
      <p>All prices in USD per month. Allowances are shared across all your websites.</p>
    </div>
    {!checkoutReady && !publicPage && <p className={styles.notice} role="status">Payment setup is in progress. Checkout is not available yet.</p>}
    <div className={styles.plans}>
      {plans.map(plan => <article className={`${styles.plan} ${plan.id === "growth" ? styles.featured : ""}`} key={plan.id}>
        <div className={styles.planTitle}><h3>{plan.name}</h3>{currentPlan === plan.id && <span>Current plan</span>}</div>
        <p className={styles.price}>${plan.monthlyCents / 100}<small> / month</small></p>
        <p className={styles.description}>{plan.description}</p>
        {publicPage ? <Link className={styles.button} href={`/login?next=${encodeURIComponent(`/account/billing?plan=${plan.id}`)}`}>Choose {plan.name}</Link>
          : hasSubscription ? <form action="/api/billing/portal" method="post"><button className={styles.button} disabled={!checkoutReady}>Manage {currentPlan === plan.id ? "subscription" : "plan change"}</button></form>
          : <form action="/api/billing/checkout" method="post"><input name="plan" type="hidden" value={plan.id} /><button className={styles.button} disabled={!checkoutReady}>{trialEligible ? `Start 7-day trial — ${plan.name}` : `Subscribe to ${plan.name}`}</button></form>}
        {trialEligible && !hasSubscription && <p className={styles.terms}>Card required. After 7 days, ${plan.monthlyCents / 100}/month plus applicable tax. Cancel before the trial ends to avoid a charge.</p>}
        <dl>{(Object.keys(meterLabels) as (keyof UsageLimits)[]).map(meter => <div key={meter}><dt>{meterLabels[meter]}</dt><dd>{plan.limits[meter] || "—"}</dd></div>)}</dl>
      </article>)}
    </div>
    <div className={styles.details}>
      <div><h3>A complete workflow on every paid plan</h3><p>Coach, strategy, manual editing, approvals, calendar, distribution planning, progress and your Google connections. Read and export your saved work even after your subscription ends.</p></div>
      <div><h3>Try the work before committing</h3><p>Start with one free website analysis after verified signup. The optional 7-day trial includes 2 articles, 10 keyword searches, 1 domain report, 2 short outputs and 10 tracked targets with up to two refreshes. Your initial analysis is reused. Infographics are not included in the trial.</p></div>
      <div><h3>Clear limits. No surprise overages.</h3><p>A keyword search returns up to 100 rows. Tracking checks the top 100 results weekly. An article includes a full draft or long-form rewrite; manual edits do not use another article. New variations count as new outputs. Research and audits have bounded coverage. Usage resets with your billing period and does not roll over.</p></div>
    </div>
  </section>;
}
const messages = {
  choose_plan: ["Ready for your next step?", "Choose a plan to start new content and research."],
  trial_ended: ["Your trial has ended", "Choose a subscription to continue creating content and running research."],
  payment_required: ["Your subscription needs attention", "Update your payment details to resume new content, research and background work."],
  limit_reached: ["You've used this allowance", "Wait for your next billing period or review your upgrade options."],
};
export function BillingNotice({ reason }: { reason: Exclude<AccessReason, "available"> | "limit_reached" }) {
  const [title, description] = messages[reason];
  return <section className={styles.notice} aria-label="Subscription notice"><h2>{title}</h2><p>{description} Your saved work remains available.</p><Link className={styles.button} href="/account/billing">{reason === "payment_required" ? "Manage billing" : "View plans and usage"}</Link></section>;
}
