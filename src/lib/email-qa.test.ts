import { describe, expect, it, vi } from "vitest";
import { sendAuditReadyEmail } from "../../supabase/functions/process-audit/email";
import { sendWelcomeEmail } from "../../supabase/functions/send-welcome/email";

describe("non-deliverable QA email addresses", () => {
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
});
