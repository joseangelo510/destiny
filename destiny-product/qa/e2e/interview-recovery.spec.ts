import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const fixturePath = process.env.QA_LOCAL_BROWSER_FIXTURE;
if (!fixturePath) throw new Error("Disposable fixture required for interview recovery.");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as { mvp: { websiteId: string } };
const words = "This is a synthetic interview for a disposable test website. We explain the available choices clearly, document the customer's question, and review the exact details together before making a recommendation. These words must remain unchanged when the interview is reopened.";

async function start(page: Page, title: string) {
  const response = await page.request.post("/api/interviews", { data: { websiteId: fixture.mvp.websiteId, topic: { title, focusKeyword: title } } });
  expect(response.status()).toBe(201);
  return (await response.json()).interview as { id: string; questions: Array<{ id: string }> };
}

async function library(page: Page) {
  await page.goto(`/interviews?site=${fixture.mvp.websiteId}`);
  await page.getByRole("button", { name: "4 Voice Library", exact: true }).click();
}

test("@gate unfinished interview resumes after saved and skipped questions", async ({ page }, testInfo) => {
  const title = `Synthetic resume ${testInfo.project.name} ${Date.now()}`;
  const interview = await start(page, title);
  expect((await page.request.post(`/api/interviews/${interview.id}/answers`, { data: { questionId: interview.questions[0].id, answer: words } })).status()).toBe(200);
  expect((await page.request.post(`/api/interviews/${interview.id}/answers`, { data: { questionId: interview.questions[1].id, skip: true } })).status()).toBe(200);
  await library(page);
  await page.getByRole("article").filter({ has: page.getByRole("heading", { name: title, exact: true }) }).getByRole("button", { name: "Resume interview", exact: true }).click();
  await expect(page.getByText("Question 3 of 7", { exact: true })).toBeVisible();
  await page.getByLabel("Your interview answer").fill(words + " The resumed answer is also preserved.");
  await page.getByRole("button", { name: "Save answer & continue →", exact: true }).click();
  await expect(page.getByText("Question 4 of 7", { exact: true })).toBeVisible();
  await library(page);
  await page.getByRole("article").filter({ has: page.getByRole("heading", { name: title, exact: true }) }).getByRole("button", { name: "Resume interview", exact: true }).click();
  await expect(page.getByText("Question 4 of 7", { exact: true })).toBeVisible();
  const recovered = await page.request.get(`/api/interviews/${interview.id}?websiteId=${fixture.mvp.websiteId}`);
  expect(recovered.status()).toBe(200);
  const data = (await recovered.json()).interview;
  expect(data.answers.map((answer: { verbatimText: string }) => answer.verbatimText)).toEqual([words, words + " The resumed answer is also preserved."]);
  expect((await page.request.get(`/api/interviews/${interview.id}?websiteId=00000000-0000-4000-8000-000000000000`)).status()).toBe(404);
});

test("@gate completed review reopens without resetting rejected insights", async ({ page }, testInfo) => {
  const title = `Synthetic review ${testInfo.project.name} ${Date.now()}`;
  const interview = await start(page, title);
  for (const [index, question] of interview.questions.entries()) {
    expect((await page.request.post(`/api/interviews/${interview.id}/answers`, { data: { questionId: question.id, ...(index ? { skip: true } : { answer: words }) } })).status()).toBe(200);
  }
  const finished = await page.request.post(`/api/interviews/${interview.id}/complete`);
  expect(finished.status()).toBe(200);
  const item = (await finished.json()).interview.libraryItems[0];
  expect((await page.request.patch(`/api/interviews/${interview.id}/insights`, { data: { itemId: item.id, status: "rejected_by_owner" } })).status()).toBe(200);
  const completionWrites: string[] = [];
  page.on("request", request => { if (request.method() === "POST" && request.url().includes(`/${interview.id}/complete`)) completionWrites.push(request.url()); });
  await library(page);
  const reopen = async () => page.getByRole("article").filter({ has: page.getByRole("heading", { name: title, exact: true }) }).getByRole("button", { name: "Review interview", exact: true }).click();
  await reopen();
  await expect(page.getByRole("heading", { name: "Here is what Rebound SEO captured.", exact: true })).toBeVisible();
  await expect(page.getByRole("blockquote").filter({ hasText: words }).first()).toHaveText(words);
  await expect(page.getByRole("button", { name: "✕ Not quite", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "2 The interview", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Here is what Rebound SEO captured.", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Finish saved interview", exact: true })).toHaveCount(0);
  const decision = page.waitForResponse(response => response.request().method() === "PATCH" && response.url().includes(`/${interview.id}/insights`));
  await page.getByRole("button", { name: "✓ That’s right", exact: true }).click();
  expect((await decision).status()).toBe(200);
  await expect(page.getByRole("button", { name: "✓ That’s right", exact: true })).toHaveAttribute("aria-pressed", "true");
  await library(page);
  await reopen();
  await expect(page.getByRole("button", { name: "✓ That’s right", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(completionWrites).toEqual([]);
});
