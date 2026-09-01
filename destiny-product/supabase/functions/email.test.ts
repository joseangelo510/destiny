import { afterEach, describe, expect, it, vi } from "vitest";
import { notificationRecipient } from "./notification-recipient";
import { sendAuditReadyEmail } from "./process-audit/email";
import { renderProgressReportEmail } from "./progress-report/email";
import { buildProgressReportSummary } from "./progress-report/logic";
import { sendWelcomeEmail } from "./send-welcome/email";
import { reboundSeoSender } from "./_shared/email-sender";

function stubSecrets(values: Record<string, string | undefined>) {
  vi.stubGlobal("Deno", { env: { get: (name: string) => values[name] } });
}

describe("Rebound SEO transactional email", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses the new display name with the configured sender address", () => {
    expect(reboundSeoSender("Destiny <auth@caminoseo.com>")).toBe("Rebound SEO <auth@caminoseo.com>");
    expect(reboundSeoSender("auth@caminoseo.com")).toBe("Rebound SEO <auth@caminoseo.com>");
  });

  it("uses the website recipient before the account-level fallback", () => {
    expect(notificationRecipient(" Reports@Client.Example ", "owner@example.com")).toBe("reports@client.example");
    expect(notificationRecipient("", " Owner@Example.com ")).toBe("owner@example.com");
  });

  it("keeps progress report acceptance distinct from delivery", () => {
    const email = renderProgressReportEmail({
      siteName: "Maya Studio",
      domain: "maya.example",
      progressUrl: "https://app.reboundseo.com/app/progress?site=site-1",
      recipient: "maya@example.com",
      requestId: "11111111-1111-4111-8111-111111111111",
      websiteId: "22222222-2222-4222-8222-222222222222",
      summary: { stats: { done: 1, needsUser: 0, inMotion: 0, stuck: 0 }, done: [{ title: "One move", detail: "Crawler confirmed it.", evidence: "verified" }], owners: { you: [], rebound: [], google: [] }, blockers: [] },
    });
    expect(email.text).toContain("Verified evidence");
    expect(email.text).not.toMatch(/delivered/i);
  });

  it("keeps an incomplete verified-live receipt in the waiting-on-Google lane", () => {
    const summary = buildProgressReportSummary({
      quests: [],
      scheduleItems: [],
      receipts: [{ articleKey: "audit-1:kiln repair", publicationStatus: "verified_live", remotePermalink: "https://example.com/kiln-repair" }],
    });
    expect(summary.owners.google).toEqual([{ title: "Kiln repair", detail: "Published and waiting on complete public verification." }]);
  });

  it("stays safely disabled when provider secrets are absent", async () => {
    stubSecrets({});
    const result = await sendWelcomeEmail({
      userId: "user-id",
      websiteId: "website-id",
      firstName: "Maya",
      recipient: "maya@example.com",
      domain: "example.com",
    });
    expect(result.status).toBe("skipped");
  });

  it("sends an audit-ready email with an idempotency key and weekly-plan link", async () => {
    stubSecrets({
      RESEND_API_KEY: "test-key",
      DESTINY_FROM_EMAIL: "Rebound SEO <hello@destiny.example>",
      DESTINY_SITE_URL: "https://app.destiny.example/",
    });
    const fetchMock = vi.fn(async () => Response.json({ id: "email-id" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendAuditReadyEmail({
      auditId: "audit-id",
      firstName: "Maya",
      recipient: "maya@example.com",
      domain: "example.com",
      weeklyQuest: "Fix the highest-impact technical issue",
    });

    expect(result).toEqual({ status: "sent", messageId: "email-id" });
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(request?.headers).toMatchObject({ "Idempotency-Key": "destiny-audit-ready-audit-id" });
    expect(String(request?.body)).toContain("https://app.destiny.example/this-week");
    expect(String(request?.body)).toContain("Open my week 1 plan");
    expect(String(request?.body)).toContain('"from":"Rebound SEO <hello@destiny.example>"');
  });
});
