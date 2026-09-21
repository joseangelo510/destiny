import { expect, test } from "@playwright/test";

for (const status of [502, 402]) {
  test(`@gate onboarding exposes ${status} after research has started`, async ({ page }) => {
    if (!process.env.QA_AUTH_STATE) throw new Error("Disposable authenticated browser fixture required.");
    const message = status === 402 ? "Choose a plan to continue research." : "Research could not start. Please try again.";
    let releaseFailure!: () => void;
    const failureReady = new Promise<void>(resolve => { releaseFailure = resolve; });
    await page.route("**/api/onboarding/competitors/suggest", route => route.fulfill({ json: { suggestions: [] } }));
    // Exercise the real form and its asynchronous transition without creating sites or provider work.
    await page.route("**/api/onboarding", route => route.fulfill({ json: { websiteId: "00000000-0000-4000-8000-000000000001" } }));
    await page.route("**/api/audits", async route => {
      await failureReady;
      await route.fulfill({ status, json: { error: message } });
    });
    await page.goto("/onboarding?new=1");
    await page.getByLabel("First name", { exact: true }).fill("Acceptance");
    await page.getByLabel("Last name", { exact: true }).fill("Tester");
    await page.getByLabel("Audit and contact email", { exact: false }).fill("acceptance@example.invalid");
    await page.getByLabel("Business name", { exact: true }).fill("Recovery fixture");
    await page.getByLabel("Business website URL", { exact: false }).fill("https://recovery.example");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByLabel("What do you sell?", { exact: true }).fill("Synthetic test services");
    await page.getByLabel("Who are your customers?", { exact: true }).fill("Test customers");
    await page.getByLabel("What problem do you fix?", { exact: true }).fill("Testing failed research recovery");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByLabel("Known competitors", { exact: true }).fill("https://one.example\nhttps://two.example");
    await page.getByLabel("What makes you stand out from competitors?", { exact: true }).fill("Explicitly synthetic acceptance fixture");
    await page.getByRole("button", { name: "Run live analysis", exact: true }).click();
    await expect(page.getByText("Live research in progress", { exact: true })).toBeVisible();
    releaseFailure();
    await expect(page.getByText(message, { exact: true })).toBeVisible();
    await expect(page.getByText("Live research in progress", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Estimated completion", { exact: true })).toHaveCount(0);
    if (status === 402) {
      await expect(page.getByRole("link", { name: "View plans and billing", exact: true })).toHaveAttribute("href", "/account/billing");
      await expect(page.getByRole("button", { name: "Review and try again", exact: true })).toHaveCount(0);
    } else {
      await page.getByRole("button", { name: "Review and try again", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Who are your competitors?", exact: true })).toBeVisible();
      await expect(page.getByLabel("Known competitors", { exact: true })).toHaveValue("https://one.example\nhttps://two.example");
      await expect(page.getByLabel("What makes you stand out from competitors?", { exact: true })).toHaveValue("Explicitly synthetic acceptance fixture");
    }
  });
}
