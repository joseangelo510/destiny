import { describe, expect, it, vi } from "vitest";
import { renderProgressReportEmail, sendProgressReport } from "./email";

const input = {
  siteName: "Maya & Co <Studio>",
  domain: "maya.example",
  progressUrl: "https://app.reboundseo.com/app/progress?site=site-1",
  recipient: "maya@example.com",
  requestId: "11111111-1111-4111-8111-111111111111",
  websiteId: "22222222-2222-4222-8222-222222222222",
  summary: {
    stats: { done: 2, needsUser: 1, inMotion: 2, stuck: 1 },
    done: [
      { title: "Publish the kiln guide", detail: "Crawler confirmed the live page.", evidence: "verified" as const, at: "2026-08-31T12:00:00Z" },
      { title: "Add three links", detail: "Reported complete in the saved plan.", evidence: "reported" as const, at: "2026-08-30T12:00:00Z" },
    ],
    owners: {
      you: [{ title: "Review the draft", detail: "Waiting on your approval." }],
      rebound: [{ title: "Publish Thursday", detail: "Scheduled for Sep 3." }],
      google: [{ title: "Glaze guide", detail: "Waiting on public verification." }],
    },
    blockers: [{ title: "Connect analytics", detail: "Conversion evidence is not connected." }],
  },
};

describe("Progress report email", () => {
  it("renders the website-scoped progress summary with honest evidence labels", () => {
    const email = renderProgressReportEmail(input);

    expect(email.subject).toBe("Maya & Co <Studio> progress report · Rebound SEO");
    expect(email.html).toContain("Maya &amp; Co &lt;Studio&gt;");
    expect(email.html).toContain("Verified evidence");
    expect(email.html).toContain("Reported complete");
    expect(email.text).toContain("DONE 2 · NEEDS YOU 1 · IN MOTION 2 · STUCK 1");
    expect(email.text).not.toMatch(/delivered/i);
  });

  it("uses one provider request with a per-click idempotency key and reports acceptance only after a provider id", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "resend-123" }), { status: 200 }));

    await expect(sendProgressReport(input, {
      env: (name) => name === "RESEND_API_KEY" ? "test-key" : "Rebound SEO <hello@example.com>",
      fetcher,
    })).resolves.toEqual({ status: "accepted", messageId: "resend-123" });

    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        "Idempotency-Key": `rebound-progress-${input.websiteId}-${input.requestId}`,
      }),
    }));
  });

  it("does not retry a rejected provider request or soften the failure", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "Provider rejected the request." }), { status: 429 }));

    await expect(sendProgressReport(input, {
      env: (name) => name === "RESEND_API_KEY" ? "test-key" : "Rebound SEO <hello@example.com>",
      fetcher,
    })).resolves.toEqual({ status: "failed", reason: "Provider rejected the request." });
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
