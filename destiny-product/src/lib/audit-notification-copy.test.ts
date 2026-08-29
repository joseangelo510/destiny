import { describe, expect, it } from "vitest";
import { auditReadyNotificationCopy } from "../../supabase/functions/process-audit/notifications";

describe("audit-ready notification copy", () => {
  it("identifies the audited website when a workspace contains multiple businesses", () => {
    expect(auditReadyNotificationCopy("lawnlove.com")).toEqual({
      title: "Your Rebound SEO weekly plan for lawnlove.com is ready",
      body: "Review lawnlove.com’s clearest opportunity, approve the initial keyword strategy, and start your week 1 plan.",
    });
  });
});
