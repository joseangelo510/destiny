import { describe, expect, it } from "vitest";
import { auditReadyNotificationCopy } from "../../supabase/functions/process-audit/notifications";

describe("audit-ready notification copy", () => {
  it("identifies the audited website when a workspace contains multiple businesses", () => {
    expect(auditReadyNotificationCopy("lawnlove.com")).toEqual({
      title: "Your Destiny plan for lawnlove.com is ready",
      body: "Your audit is complete. Start this week’s one useful step, then move through the rest of your guided plan.",
    });
  });
});
