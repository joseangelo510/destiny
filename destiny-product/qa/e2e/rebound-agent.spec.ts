import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

type BrowserFixture = { mvp: { websiteId: string } };
const fixturePath = process.env.QA_LOCAL_BROWSER_FIXTURE;
const fixture = fixturePath ? JSON.parse(readFileSync(fixturePath, "utf8")) as BrowserFixture : null;
if (!fixture) throw new Error("Run pnpm qa:browser-fixture against disposable local Supabase first.");

test.describe("@gate Rebound Agent", () => {
  test("shows visible work and requires approval before creating a draft", async ({ page }) => {
    await page.route("**/api/agent/turn", (route) => route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: [
        'event: status\ndata: {"type":"status","message":"Reading saved SEO evidence"}\n',
        'event: tool_start\ndata: {"type":"tool_start","name":"get_progress_summary"}\n',
        'event: tool_end\ndata: {"type":"tool_end","name":"get_progress_summary","summary":"Loaded current progress"}\n',
        'event: text\ndata: {"type":"text","text":"The clearest move is a stronger audit page."}\n',
        'event: proposal\ndata: {"type":"proposal","proposal":{"id":"11111111-1111-4111-8111-111111111112","status":"proposed","title":"Create an SEO audit draft","targetKeyword":"seo audit","angle":"Evidence first","outlineBullets":["Proof","Decision"]}}\n',
        'event: done\ndata: {"type":"done","conversationId":"11111111-1111-4111-8111-111111111113"}\n',
      ].join("\n"),
    }));
    await page.route("**/api/agent/proposals/*/decide", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "approved", artifactId: "11111111-1111-4111-8111-111111111114", href: "/app/content" }),
    }));

    await page.goto("/app/agent?site=" + fixture!.mvp.websiteId, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Ask Rebound" })).toBeVisible();
    await page.getByLabel("Message Rebound").fill("What should I improve first?");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("Loaded current progress")).toBeVisible();
    await expect(page.getByText("The clearest move is a stronger audit page.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create draft" })).toBeVisible();
    await page.getByRole("button", { name: "Create draft" }).click();
    await expect(page.getByRole("link", { name: "Draft created · open draft" })).toBeVisible();
    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(accessibility.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? ""))).toEqual([]);
  });
});
