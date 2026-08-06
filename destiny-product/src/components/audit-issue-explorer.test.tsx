import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildAuditDashboard } from "../lib/seo/audit-dashboard";
import { AuditIssueExplorer } from "./audit-issue-explorer";

describe("AuditIssueExplorer", () => {
  it("renders severity and category filters with complete issue guidance", async () => {
    const dashboard = await buildAuditDashboard({
      healthScore: 61,
      inspectedPages: 2,
      inspectedUrl: "https://example.com/",
      measuredCritical: 1,
      measuredWarnings: 1,
      issues: [
        { code: "no_title", label: "Page title is missing", severity: "critical" },
        { code: "high_loading_time", label: "Page takes more than three seconds to load", severity: "warning" },
      ],
    });
    const html = renderToStaticMarkup(<AuditIssueExplorer issues={dashboard.issues} />);

    expect(html).toContain("All issues");
    expect(html).toContain("Critical");
    expect(html).toContain("Warnings");
    expect(html).toContain("Category");
    expect(html).toContain("Affected pages");
    expect(html).toContain("Why it matters");
    expect(html).toContain("What to do next");
    expect(html).toContain("Page title is missing");
  });
});
