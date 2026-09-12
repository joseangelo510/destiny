import { expect, it } from "vitest";
import { billingConfig } from "../../supabase/functions/_shared/billing/config";
it("keeps billing unavailable until a portal configuration is explicitly supplied", () => {
  const env: Record<string, string> = {
    BILLING_ENABLED: "true", BILLING_MODE: "test", BILLING_APP_ORIGIN: "http://127.0.0.1:4173",
    BILLING_STRIPE_SECRET_KEY: "sk_test_fixture", BILLING_STRIPE_WEBHOOK_SECRET: "whsec_fixture",
    BILLING_STRIPE_ACCOUNT_ID: "acct_fixture", BILLING_PRICE_STARTER: "price_a",
    BILLING_PRICE_GROWTH: "price_b", BILLING_PRICE_PREMIUM: "price_c",
  };
  expect(billingConfig(name => env[name])).toBeNull();
  env.BILLING_PORTAL_CONFIGURATION_ID = "bpc_fixture";
  expect(billingConfig(name => env[name])).toMatchObject({ portalConfigurationId: "bpc_fixture", livemode: false });
});
