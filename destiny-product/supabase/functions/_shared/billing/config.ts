import type { StripePrices } from "./stripe-contract.ts";
export type BillingConfig = { key: string; accountId: string; webhookSecret: string; portalConfigurationId: string; priceIds: StripePrices; origin: string; livemode: boolean };
export function billingConfig(env: (name: string) => string | undefined): BillingConfig | null {
  const key = env("BILLING_STRIPE_SECRET_KEY")?.trim() ?? "";
  const accountId = env("BILLING_STRIPE_ACCOUNT_ID")?.trim() ?? "";
  const webhookSecret = env("BILLING_STRIPE_WEBHOOK_SECRET")?.trim() ?? "";
  const portalConfigurationId = env("BILLING_PORTAL_CONFIGURATION_ID")?.trim() ?? "";
  if (!/^bpc_[a-zA-Z0-9]+$/.test(portalConfigurationId)) return null;
  const mode = env("BILLING_MODE");
  const origin = env("BILLING_APP_ORIGIN")?.trim() ?? "";
  const priceIds = { starter: env("BILLING_PRICE_STARTER") ?? "", growth: env("BILLING_PRICE_GROWTH") ?? "", premium: env("BILLING_PRICE_PREMIUM") ?? "" };
  if (env("BILLING_ENABLED") !== "true" || !["test", "live"].includes(mode ?? "")) return null;
  if (!key.startsWith(mode === "live" ? "sk_live_" : "sk_test_") || !accountId.startsWith("acct_") || !webhookSecret.startsWith("whsec_")) return null;
  if (new Set(Object.values(priceIds)).size !== 3 || Object.values(priceIds).some(id => !/^price_[a-zA-Z0-9]+$/.test(id))) return null;
  try {
    const url = new URL(origin);
    if (url.origin !== origin || url.username || url.password) return null;
    if (mode === "live" && origin !== "https://app.reboundseo.com") return null;
    if (mode === "test" && url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) return null;
  } catch { return null; }
  return { key, accountId, webhookSecret, portalConfigurationId, priceIds, origin, livemode: mode === "live" };
}
