import { describe, expect, it } from "vitest";
import { renderContinuityEmail, renderOnboardingDataLandedEmail, renderWeeklyScorecardEmail } from "./email-templates";
import { buildScorecardSnapshot } from "./scorecard";

const snapshot = buildScorecardSnapshot({
  accountId: "account-1",
  websiteId: "website-1",
  messageId: "message-1",
  weekNumber: 33,
  streakLength: 2,
  weekState: "completed",
  freezesRemaining: 2,
  metrics: [{ key: "keywords", label: "Ranking keywords", value: "25", delta: "+4", direction: "up", sparkline: [18, 20, 21, 25] }],
  wins: [{ objectName: "Keyword strategy", objectUrl: "/keywords?site=website-1", from: "Open", to: "Approved", metric: "5 searches" }],
  cta: { label: "Continue this Week", deepLink: "/this-week?site=website-1", timeCostMinutes: 15 },
  nextWeek: { weekNumber: 34, actionsRequired: 1, timeCostMinutes: 15 },
});

describe("Destiny comms email templates", () => {
  it("renders scorecard values and scoped links from the snapshot", () => {
    const html = renderWeeklyScorecardEmail(snapshot, "https://destiny.example");
    expect(html).toContain("Ranking keywords");
    expect(html).toContain("25");
    expect(html).toContain("https://destiny.example/this-week?site=website-1");
    expect(html).toContain("Change communication cadence");
  });

  it("escapes user-controlled copy", () => {
    const html = renderOnboardingDataLandedEmail({ appUrl: "https://destiny.example", achievementName: "First <script>", minutes: 10, websiteName: "A&B" });
    expect(html).not.toContain("<script>");
    expect(html).toContain("First &lt;script&gt;");
    expect(html).toContain("A&amp;B");
  });

  it("renders exactly the Friday and Sunday continuity variants", () => {
    const friday = renderContinuityEmail({ appUrl: "https://destiny.example", kind: "friday-risk", minutes: 15, streakLength: 3, websiteName: "Hardin AI" });
    const sunday = renderContinuityEmail({ appUrl: "https://destiny.example", kind: "sunday-last-chance", minutes: 15, streakLength: 3, websiteName: "Hardin AI" });
    expect(friday).toContain("Friday Week at risk");
    expect(sunday).toContain("Sunday last chance");
  });
});
