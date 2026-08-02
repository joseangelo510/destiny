import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AuditMomentumProcessing } from "./audit-momentum-processing";

describe("AuditMomentumProcessing", () => {
  it("renders a durable, truthful research journey from saved audit progress", () => {
    const html = renderToStaticMarkup(<AuditMomentumProcessing
      auditId="audit-123"
      initialProgress={65}
      initialStatus="running"
      website="example.com"
    />);

    expect(html).toContain("Your momentum is building for example.com");
    expect(html).toContain("65% saved");
    expect(html).toContain('aria-valuenow="65"');
    expect(html).toContain("Revenue-ready keywords");
    expect(html).toContain("Working now");
    expect((html.match(/Research saved/g) ?? [])).toHaveLength(4);
    expect(html).not.toContain("decorative timer");
  });

  it("shows an honest recovery state instead of pretending progress continued", () => {
    const html = renderToStaticMarkup(<AuditMomentumProcessing
      auditId="audit-123"
      failureMessage="The provider could not return competitor evidence."
      initialProgress={46}
      initialStatus="failed"
      website="example.com"
    />);

    expect(html).toContain("Research paused");
    expect(html).toContain("The provider could not return competitor evidence.");
    expect(html).toContain("Needs attention");
    expect(html).toContain("Review and try again");
  });
});
