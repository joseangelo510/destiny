import { describe, expect, it, vi } from "vitest";
import { sendAuditReadyEmail, sendAuditReadyEmailWithRetry, withEmailDelivery } from "../../supabase/functions/process-audit/email";
import { sendWelcomeEmail } from "../../supabase/functions/send-welcome/email";

describe("non-deliverable QA email addresses", () => {
  it("preserves audit evidence while recording the truthful delivery result", () => {
    expect(withEmailDelivery({ providerResult: { domain: "98junkit.com" }, growthStage: "foundation" }, {
      status: "skipped",
      reason: "Transactional email secrets are not configured.",
    })).toEqual({
      providerResult: { domain: "98junkit.com" },
      growthStage: "foundation",
      emailDelivery: { status: "skipped", reason: "Transactional email secrets are not configured." },
    });
  });
  it("never calls an email provider for welcome or audit-ready QA messages", async () => {
    const provider = vi.spyOn(globalThis, "fetch");

    await expect(sendWelcomeEmail({
      userId: "qa-user",
      websiteId: "qa-website",
      firstName: "QA",
      recipient: "qa-welcome@example.invalid",
      domain: "empowerly.com",
    })).resolves.toEqual({ status: "skipped", reason: "Non-deliverable QA address." });

    await expect(sendAuditReadyEmail({
      auditId: "qa-audit",
      firstName: "QA",
      recipient: "qa-results@example.invalid",
      domain: "empowerly.com",
      weeklyQuest: "Publish the highest-opportunity page",
    })).resolves.toEqual({ status: "skipped", reason: "Non-deliverable QA address." });

    expect(provider).not.toHaveBeenCalled();
    provider.mockRestore();
  });

  it("retries provider failures but never retries a configuration skip", async () => {
    const failedThenSent = vi.fn()
      .mockResolvedValueOnce({ status: "failed", reason: "Temporary provider error" })
      .mockResolvedValueOnce({ status: "sent", messageId: "email-123" });
    const sleep = vi.fn().mockResolvedValue(undefined);
    const input = {
      auditId: "audit-123",
      firstName: "Maya",
      recipient: "maya@example.com",
      domain: "example.com",
      weeklyQuest: "Publish the highest-opportunity page",
    };

    await expect(sendAuditReadyEmailWithRetry(input, { send: failedThenSent, sleep })).resolves.toEqual({ status: "sent", messageId: "email-123" });
    expect(failedThenSent).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);

    const skipped = vi.fn().mockResolvedValue({ status: "skipped", reason: "Transactional email secrets are not configured." });
    await expect(sendAuditReadyEmailWithRetry(input, { send: skipped, sleep })).resolves.toMatchObject({ status: "skipped" });
    expect(skipped).toHaveBeenCalledTimes(1);
  });
});
