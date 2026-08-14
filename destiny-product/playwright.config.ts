import { defineConfig, devices } from "@playwright/test";

const productionReadOnly = process.env.QA_PROD_READONLY === "1";
const baseURL = productionReadOnly
  ? "https://destiny-seo.replit.app"
  : process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./qa/e2e",
  outputDir: "./qa/artifacts/playwright",
  fullyParallel: !productionReadOnly,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "qa/artifacts/playwright-report" }]],
  use: {
    baseURL,
    storageState: process.env.QA_AUTH_STATE || undefined,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chrome" } },
    {
      name: "mobile",
      use: {
        browserName: "chromium",
        channel: "chrome",
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
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
