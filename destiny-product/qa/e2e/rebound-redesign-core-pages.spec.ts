import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

type BrowserFixture = {
  mvp: {
    draftId: string;
    distributionOpportunity: { checkedAt: string; platform: "Quora" | "Reddit"; snippet: string; title: string; url: string };
    websiteId: string;
  };
};
const fixturePath = process.env.QA_LOCAL_BROWSER_FIXTURE;
const fixture = fixturePath ? JSON.parse(readFileSync(fixturePath, "utf8")) as BrowserFixture : null;

function requireFixture() {
  if (!fixture) throw new Error("Run pnpm qa:browser-fixture against disposable local Supabase first.");
  return fixture;
}

async function verifyPageHealth(page: Page, mobile: boolean, consoleErrors: string[], pageErrors: string[], preview = "Preview — read-only.") {
  await expect(page.locator('[data-rebound-core="v1"]')).toBeVisible();
  await expect(page.getByText(preview)).toBeVisible();
  for (const href of ["/app/home", "/app/content", "/app/calendar", "/app/distribution", "/app/progress"]) {
    await expect(page.locator(`a[href^="${href}"]`).first()).toBeAttached();
  }
  expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(mobile ? 390 : 1360);
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? ""))).toEqual([]);
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
}

test.describe("@gate Rebound redesign read-only core pages", () => {
  for (const expected of [
    { route: "content", heading: "Content", landmark: "Content pipeline" },
    { route: "calendar", heading: "Calendar", landmark: "The month", preview: "Preview — calendar scheduling enabled." },
    { route: "distribution", heading: "Distribution", landmark: "Reach what you published", preview: "Preview — distribution actions enabled." },
    { route: "progress", heading: "Progress", landmark: "What needs to be done", preview: "Preview — progress reports enabled." },
  ]) {
    test(`${expected.route} renders real scoped evidence at the approved viewport`, async ({ page }, testInfo) => {
      const activeFixture = requireFixture();
      const mobile = testInfo.project.name === "mobile";
      await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1360, height: 1000 });
      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];
      page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
      page.on("pageerror", (error) => pageErrors.push(error.message));

      const response = await page.goto(`/app/${expected.route}?site=${activeFixture.mvp.websiteId}`, { waitUntil: "networkidle" });
      expect(response?.status()).toBe(200);
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.getByRole("heading", { level: 1, name: expected.heading })).toBeVisible();
      if (expected.route === "content") await expect(page.getByRole("region", { name: expected.landmark })).toBeVisible();
      else await expect(page.getByText(expected.landmark, { exact: true }).first()).toBeVisible();
      if (expected.route === "calendar") {
        await expect(page.getByRole("button", { name: "Schedule approved draft" })).toBeVisible();
        await expect(page.getByText("Milestone not configured", { exact: true })).toBeVisible();
      }
      await expect(page.locator("body")).not.toContainText(/Approve all|Publish now|Send as report|Request edits/i);
      await verifyPageHealth(page, mobile, consoleErrors, pageErrors, expected.preview);

      if (process.env.QA_CAPTURE_REBOUND_SCREENSHOTS === "1") {
        const viewport = mobile ? "mobile-390x844" : "desktop-1360x1000";
        await page.screenshot({ path: resolve(process.cwd(), "../docs/design/redesign-v1/screenshots", `${expected.route}-actual-${viewport}.png`), fullPage: false });
      }
    });
  }

  test("Calendar schedules one approved draft through the existing publishing-plan POST", async ({ page }, testInfo) => {
    const activeFixture = requireFixture();
    if (testInfo.project.name === "mobile") {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`/app/calendar?site=${activeFixture.mvp.websiteId}`, { waitUntil: "networkidle" });
      await expect(page.getByRole("button", { name: "Schedule approved draft" })).toBeVisible();
      return;
    }
    await page.setViewportSize({ width: 1360, height: 1000 });
    const writes: Array<Record<string, unknown>> = [];
    page.on("request", (request) => {
      if (request.method() === "POST" && request.url().includes("/api/content/publishing-plan")) {
        writes.push(request.postDataJSON() as Record<string, unknown>);
      }
    });

    await page.goto(`/app/calendar?site=${activeFixture.mvp.websiteId}`, { waitUntil: "networkidle" });
    const title = "small business seo consultant: a practical guide";
    await expect(page.getByRole("option", { name: new RegExp(title, "i") })).toBeAttached();
    await page.getByRole("link", { name: /Add content on/ }).first().click();
    const responsePromise = page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/api/content/publishing-plan"));
    await page.getByRole("button", { name: "Schedule approved draft" }).click();
    expect((await responsePromise).status()).toBe(201);
    await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({
      websiteId: activeFixture.mvp.websiteId,
      contentType: "approved_draft",
      title,
      focusKeyword: "small business seo consultant",
    });
    expect(writes[0]).not.toHaveProperty("draftId");
  });

  test("Distribution copies only saved context and opens only the exact saved live thread", async ({ page }, testInfo) => {
    const activeFixture = requireFixture();
    const mobile = testInfo.project.name === "mobile";
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1360, height: 1000 });
    await page.addInitScript(() => {
      const state = { copied: "", opened: [] as Array<{ features?: string; target?: string; url?: string }> };
      Object.defineProperty(window, "__distributionActionState", { configurable: true, value: state });
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (text: string) => { state.copied = text; } } });
      window.open = ((url?: string | URL, target?: string, features?: string) => {
        state.opened.push({ features, target, url: String(url) });
        return null;
      }) as typeof window.open;
    });
    const mutatingRequests: string[] = [];
    page.on("request", (request) => {
      if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) mutatingRequests.push(`${request.method()} ${request.url()}`);
    });

    await page.goto(`/app/distribution?site=${activeFixture.mvp.websiteId}`, { waitUntil: "networkidle" });
    mutatingRequests.length = 0;
    const row = page.locator('[data-distribution-kind="opportunity"]').first();
    await expect(row).toContainText(activeFixture.mvp.distributionOpportunity.title);
    await expect(row).toContainText("you move");
    await expect(row).toContainText("opens www.quora.com");
    await expect(row).not.toContainText(/answer drafted|answered|posted|approved|done/i);
    await expect(page.locator("body")).not.toContainText(/Approve all we post|batch approve/i);

    await row.getByRole("button", { name: "Copy saved context and open Quora" }).click();
    await expect(row.getByRole("status")).toHaveText("Context copied.");
    const browserState = await page.evaluate(() => (window as typeof window & { __distributionActionState: { copied: string; opened: Array<{ features?: string; target?: string; url?: string }> } }).__distributionActionState);
    expect(browserState.copied).toBe([
      activeFixture.mvp.distributionOpportunity.title,
      activeFixture.mvp.distributionOpportunity.snippet,
      activeFixture.mvp.distributionOpportunity.url,
      `Checked ${activeFixture.mvp.distributionOpportunity.checkedAt}`,
    ].join("\n"));
    expect(browserState.opened).toEqual([{ features: "noopener,noreferrer", target: "_blank", url: activeFixture.mvp.distributionOpportunity.url }]);
    expect(mutatingRequests).toEqual([]);
  });

  test("Progress sends one scoped report request and claims provider acceptance only", async ({ page }, testInfo) => {
    const activeFixture = requireFixture();
    const mobile = testInfo.project.name === "mobile";
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1360, height: 1000 });
    const requests: Array<Record<string, unknown>> = [];
    await page.route("**/api/progress/report", async (route) => {
      requests.push(route.request().postDataJSON() as Record<string, unknown>);
      await route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ status: "accepted", messageId: "mock-resend-123" }) });
    });

    await page.goto(`/app/progress?site=${activeFixture.mvp.websiteId}`, { waitUntil: "networkidle" });
    const button = page.getByRole("button", { name: /^Send progress report to / });
    await expect(button).toBeVisible();
    await button.click();
    await expect(page.getByRole("status", { name: "" }).filter({ hasText: "Accepted for delivery." })).toBeVisible();
    expect(requests).toHaveLength(1);
    expect(requests[0]).toEqual({ websiteId: activeFixture.mvp.websiteId, requestId: expect.stringMatching(/^[0-9a-f-]{36}$/i) });
    expect(requests[0]).not.toHaveProperty("recipient");
    await expect(page.locator('[data-progress-report="manual"]')).not.toContainText(/delivered|sent/i);
  });

  test("draft detail enables only the governed approval path", async ({ page }, testInfo) => {
    const activeFixture = requireFixture();
    const mobile = testInfo.project.name === "mobile";
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1360, height: 1000 });
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const draftWrites: string[] = [];
    page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("request", (request) => {
      if (request.method() === "PUT" && request.url().includes("/api/content/drafts")) draftWrites.push(request.url());
    });

    const response = await page.goto(`/app/content/${activeFixture.mvp.draftId}?site=${activeFixture.mvp.websiteId}`, { waitUntil: "networkidle" });
    expect(response?.status()).toBe(200);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { level: 1, name: "Content" })).toBeVisible();
    await expect(page.getByText("Preview — draft approval enabled.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Fix issues before approval" })).toBeDisabled();
    const editLink = page.getByRole("link", { name: "Edit in Content Studio" });
    await expect(editLink).toHaveAttribute("href", `/content?site=${activeFixture.mvp.websiteId}#article-review-workspace`);
    await expect(page.locator("body")).not.toContainText("Request edits");
    expect(draftWrites).toEqual([]);
    expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(mobile ? 390 : 1360);
    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(accessibility.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? ""))).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);

    if (process.env.QA_CAPTURE_REBOUND_SCREENSHOTS === "1") {
      const viewport = mobile ? "mobile-390x844" : "desktop-1360x1000";
      await page.screenshot({ path: resolve(process.cwd(), "../docs/design/redesign-v1/screenshots", `content-draft-actions-${viewport}.png`), fullPage: false });
    }
  });
});
