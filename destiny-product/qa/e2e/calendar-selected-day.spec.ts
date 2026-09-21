import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { calendarLocalDateTimeAsUtc } from "../../src/lib/content/publishing-plan";

const fixturePath = process.env.QA_LOCAL_BROWSER_FIXTURE;
if (!fixturePath) throw new Error("Disposable browser fixture is required for calendar certification.");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as { mvp: { websiteId: string } };

test("@gate chosen calendar day reaches the form and persists after reload", async ({ page }, testInfo) => {
  await page.setViewportSize(testInfo.project.name === "mobile" ? { width: 390, height: 844 } : { width: 1360, height: 1000 });
  await page.goto(`/app/calendar?site=${fixture.mvp.websiteId}`);
  const day = page.getByLabel("Open calendar day", { exact: true });
  const dates = await day.locator('option:not([value=""])').evaluateAll(options => options.map(option => (option as HTMLOptionElement).value));
  expect(dates.length).toBeGreaterThan(0);
  const draft = page.getByLabel("Approved draft", { exact: true });
  const draftId = await draft.locator("option").last().getAttribute("value");
  await draft.selectOption(draftId!);
  const selected = dates.at(-1)!;
  await page.getByRole("link", { name: `Add content on ${selected}`, exact: true }).filter({ visible: true }).click();
  await expect(day).toHaveValue(selected);
  await expect(draft).toHaveValue(draftId!);
  // Changing the selected day must not reset the chosen draft.
  await page.getByRole("link", { name: `Add content on ${dates[0]}`, exact: true }).filter({ visible: true }).click();
  await expect(day).toHaveValue(dates[0]);
  await expect(draft).toHaveValue(draftId!);
  await page.getByRole("link", { name: `Add content on ${selected}`, exact: true }).filter({ visible: true }).click();
  const before = await page.request.get(`/api/content/publishing-plan?websiteId=${fixture.mvp.websiteId}`);
  expect(before.status()).toBe(200);
  const { plan } = await before.json();
  const expectedTimestamp = calendarLocalDateTimeAsUtc(`${selected}T09:00`, plan.timezone);
  const responsePromise = page.waitForResponse(response => response.request().method() === "POST" && response.url().includes("/api/content/publishing-plan"));
  await page.getByRole("button", { name: "Schedule approved draft", exact: true }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(201);
  expect(response.request().postDataJSON()).toMatchObject({ websiteId: fixture.mvp.websiteId, scheduledFor: expectedTimestamp });
  const { item } = await response.json();
  await expect(day).toHaveValue("");
  await expect(page.getByRole("button", { name: "Schedule approved draft", exact: true })).toBeDisabled();
  await page.reload();
  const persisted = await page.request.get(`/api/content/publishing-plan?websiteId=${fixture.mvp.websiteId}`);
  expect(persisted.status()).toBe(200);
  const saved = (await persisted.json()).items.find((row: { id: string }) => row.id === item.id);
  expect(saved).toBeTruthy();
  expect(saved.title).toBe(response.request().postDataJSON().title);
  expect(saved.keyword).toBe(response.request().postDataJSON().focusKeyword);
  expect(new Date(saved.scheduled_for).toISOString()).toBe(expectedTimestamp);
  await expect(page).toHaveURL(new RegExp(`site=${fixture.mvp.websiteId}`));
  await expect(page.getByRole("link", { name: `Add content on ${selected}`, exact: true })).toHaveCount(0);
});

test("@gate calendar day actions only offer available dates", async ({ page }) => {
  await page.goto(`/app/calendar?site=${fixture.mvp.websiteId}`);
  const dates = await page.getByLabel("Open calendar day", { exact: true }).locator('option:not([value=""])').evaluateAll(options => options.map(option => (option as HTMLOptionElement).value));
  const links = await page.getByRole("link", { name: /Add content on/ }).all();
  for (const link of links) {
    const label = await link.getAttribute("aria-label");
    expect(dates).toContain(label!.replace("Add content on ", ""));
  }
});
