import { afterEach, describe, expect, it, vi } from "vitest";
import { sendAuditReadyEmail } from "./process-audit/email";
import { sendWelcomeEmail } from "./send-welcome/email";

function stubSecrets(values: Record<string, string | undefined>) {
  vi.stubGlobal("Deno", { env: { get: (name: string) => values[name] } });
}

describe("Destiny transactional email", () => {
  afterEach(() => vi.unstubAllGlobals());

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

  it("sends an audit-ready email with an idempotency key and saved-results link", async () => {
    stubSecrets({
      RESEND_API_KEY: "test-key",
      DESTINY_FROM_EMAIL: "Destiny <hello@destiny.example>",
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
    expect(String(request?.body)).toContain("https://app.destiny.example/audits/audit-id");
  });
});
