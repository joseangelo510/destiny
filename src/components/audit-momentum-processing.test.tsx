import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AuditMomentumProcessing } from "./audit-momentum-processing";
import { runDestinyServerLogic } from "../lib/logicaffeine-server";

const base = { auditComplete: 0, criticalIssues: 0, warnings: 0, rankingKeywords: 0, newKeywords: 0, lostKeywords: 0, contentGaps: 0, reviewCount: 0 };

describe("AuditMomentumProcessing", () => {
  it("renders a durable, truthful research journey from saved audit progress", async () => {
    const initialPolicy = await runDestinyServerLogic({ ...base, momentumAuditProgress: 65, momentumAuditStatusCode: 0, momentumElapsedSeconds: 0 });
    const html = renderToStaticMarkup(<AuditMomentumProcessing
      auditId="audit-123"
      initialProgress={65}
      initialPolicy={initialPolicy}
      initialStatus="running"
      website="example.com"
    />);

    expect(html).toContain("Your momentum is building for example.com");
    expect(html).toContain("Almost there. This is the fun part.");
    expect(html).toContain("65% saved");
    expect(html).toContain("About 15 seconds remaining");
    expect(html).toContain("Most reports finish in about 30 seconds");
    expect(html).toContain('aria-valuenow="65"');
    expect(html).toContain("Revenue-ready keywords");
    expect(html).toContain("Working now");
    expect((html.match(/Research saved/g) ?? [])).toHaveLength(4);
    expect(html).not.toContain("decorative timer");
    expect(html).toContain("notification center will link back");
    expect(html).toContain("email when delivery is available");
    expect(html).not.toContain("six-month");
  });

  it("shows an honest recovery state instead of pretending progress continued", async () => {
    const initialPolicy = await runDestinyServerLogic({ ...base, momentumAuditProgress: 46, momentumAuditStatusCode: 2 });
    const html = renderToStaticMarkup(<AuditMomentumProcessing
      auditId="audit-123"
      failureMessage="The provider could not return competitor evidence."
      initialProgress={46}
      initialPolicy={initialPolicy}
      initialStatus="failed"
      website="example.com"
    />);

    expect(html).toContain("Research paused");
    expect(html).toContain("Now we know where it stopped. Let’s get it moving again.");
    expect(html).toContain("The provider could not return competitor evidence.");
    expect(html).toContain("Needs attention");
    expect(html).toContain("Review and try again");
  });
});
