import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("public homepage has working primary journeys and no serious accessibility violations", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Destiny/i);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  const onboardingLinks = page.locator('a[href*="/onboarding"]');
  expect(await onboardingLinks.count()).toBeGreaterThan(0);
  await expect(onboardingLinks.first()).toBeVisible();

  const accessibility = await new AxeBuilder({ page }).analyze();
  const serious = accessibility.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? ""));
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
});

test("all visible homepage controls have an accessible name", async ({ page }) => {
  await page.goto("/");
  const unnamed = await page.locator('button, a[href], input, select, textarea, [role="button"], [role="tab"]').evaluateAll((elements) =>
    elements.filter((element) => {
      const html = element as HTMLElement;
      if (html.offsetParent === null) return false;
      const label = html.getAttribute("aria-label") || html.getAttribute("title") || html.textContent || (html as HTMLInputElement).placeholder;
      return !label?.trim();
    }).map((element) => element.outerHTML.slice(0, 240)),
  );
  expect(unnamed, `Unnamed visible controls:\n${unnamed.join("\n")}`).toEqual([]);
});

test("public recovery and legacy routes fail safely", async ({ page }) => {
  const authErrorResponse = await page.goto("/auth/error");
  expect(authErrorResponse?.status()).toBeLessThan(500);
  await expect(page.getByRole("heading", { name: "Let’s send a fresh one." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Return to sign in" })).toHaveAttribute("href", "/login");

  const growthPlanResponse = await page.goto("/growth-plan");
  expect(growthPlanResponse?.status()).toBeLessThan(500);
  await expect(page).toHaveURL(/\/(?:results|login)(?:[?#]|$)/);
});

test("public entry and guarded workspace routes fail closed without a session", async ({ page }) => {
  for (const route of ["/login", "/onboarding?new=1"]) {
    const response = await page.goto(route, { waitUntil: "domcontentloaded" });
    expect(response?.status(), route).toBeLessThan(500);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }

  const confirmation = await page.goto("/auth/confirm", { waitUntil: "domcontentloaded" });
  expect(confirmation?.status()).toBeLessThan(500);
  await expect(page).toHaveURL(/\/auth\/error$/);

  const signout = await page.request.post("/auth/signout", { maxRedirects: 0 });
  expect(signout.status()).toBe(303);
  expect(new URL(signout.headers().location).pathname).toBe("/");

  for (const route of [
    "/app",
    "/content/infographics",
    "/content/repurpose",
    "/internal-links",
    "/interviews",
    "/reoptimization/missing-document",
  ]) {
    const response = await page.goto(route, { waitUntil: "domcontentloaded" });
    expect(response?.status(), route).toBeLessThan(500);
    await expect(page).toHaveURL(/\/(?:login|onboarding)(?:[?#]|$)/);
  }
});
