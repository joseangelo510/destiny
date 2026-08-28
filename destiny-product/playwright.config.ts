import { defineConfig, devices } from "@playwright/test";

const productionReadOnly = process.env.QA_PROD_READONLY === "1";
const baseURL = productionReadOnly
  ? "https://destiny-seo.replit.app"
  : process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./qa/e2e",
  testIgnore: productionReadOnly ? [] : ["**/prod-readonly.spec.ts"],
  outputDir: "./qa/artifacts/playwright",
  fullyParallel: !productionReadOnly,
  forbidOnly: Boolean(process.env.CI),
  // A fail-then-pass is flaky evidence, never a green gate.
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "qa/artifacts/playwright-report" }]],
  use: {
    baseURL,
    // Replit environment fix: Playwright's downloaded browsers cannot run on
    // NixOS (missing shared libraries). CHROMIUM_BIN points at the Nix-provided
    // chromium; unset elsewhere, Playwright falls back to its own browsers.
    launchOptions: process.env.CHROMIUM_BIN ? { executablePath: process.env.CHROMIUM_BIN } : undefined,
    storageState: process.env.QA_AUTH_STATE || undefined,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } }, // channel: "chrome" removed: branded Chrome unavailable in Replit env
    {
      name: "mobile",
      use: {
        browserName: "chromium",
        // channel: "chrome" removed: branded Chrome unavailable in Replit env
        deviceScaleFactor: 2,
        hasTouch: true,
        isMobile: true,
        viewport: { width: 375, height: 812 },
      },
    },
  ],
  webServer: productionReadOnly
    ? undefined
    : {
        command: "pnpm dev --hostname 127.0.0.1 --port 4173",
        url: "http://127.0.0.1:4173",
        env: {
          ...process.env,
          NEXT_PUBLIC_SUPABASE_URL:
            process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://supabase.invalid",
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
            process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_playwright_placeholder",
        },
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
