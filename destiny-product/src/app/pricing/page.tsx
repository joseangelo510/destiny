import Link from "next/link";
import type { Metadata } from "next";
import { PricingPlans } from "@/components/billing/pricing-plans";
import styles from "@/components/billing/pricing.module.css";
export const metadata: Metadata = { title: "Pricing — Rebound SEO", description: "Choose Starter, Growth or Premium for your SEO workflow." };
export default function PricingPage() {
  return <main className={styles.public}><header className={styles.header}><Link className={styles.wordmark} href="/">Rebound <em>SEO.</em></Link><Link href="/account/billing">My subscription</Link></header><PricingPlans checkoutReady={false} trialEligible publicPage /></main>;
}
