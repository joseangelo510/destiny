import { expect, test } from "@playwright/test";

test("login cooldown explains retry and keeps the workspace destination", async ({ page }) => {
  const params = new URLSearchParams({ email: "sam@example.com", next: "/app/content?site=test", retry: "2", error: "Please wait before requesting another sign-in link." });
  await page.goto(`/login?${params}`);
  await expect(page.getByLabel("Email address")).toHaveValue("sam@example.com");
  await expect(page.getByRole("alert")).toContainText("Please wait");
  await expect(page.getByRole("button", { name: /Try again in/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Email me a sign-in link" })).toBeEnabled({ timeout: 5000 });
  await expect(page.locator('input[name="next"]')).toHaveValue("/app/content?site=test");
});

test("confirmation provides resend and keeps destination when switching email", async ({ page }) => {
  const params = new URLSearchParams({ sent: "1", email: "sam@example.com", next: "/app/content?site=test" });
  await page.goto(`/login?${params}`);
  await expect(page.getByRole("heading", { name: "Your next chapter is waiting." })).toBeVisible();
  await expect(page.getByRole("button", { name: /Try again in/ })).toBeDisabled();
  await page.getByRole("link", { name: "Use another email" }).click();
  await expect(page.getByLabel("Email address")).toBeEmpty();
  await expect(page.locator('input[name="next"]')).toHaveValue("/app/content?site=test");
});
