import { describe, expect, it } from "vitest";
import { buildAuditDashboard } from "./audit-dashboard";

describe("audit dashboard view model", () => {
  it("uses the provider health score without inventing a replacement", async () => {
    const dashboard = await buildAuditDashboard({
      healthScore: 73.6,
      inspectedPages: 4,
      inspectedUrl: "https://example.com/",
      measuredCritical: 1,
      measuredWarnings: 2,
      issues: [],
    });

    expect(dashboard.healthScore).toBe(74);
    expect(dashboard.healthLabel).toBe("Needs attention");
    expect(dashboard.coverageLabel).toContain("homepage technical scan");
    expect(dashboard.coverageLabel).toContain("4 strategic pages");
    expect(dashboard.isPartial).toBe(true);
  });

  it("keeps the health score unavailable when the provider did not return one", async () => {
    const dashboard = await buildAuditDashboard({
      healthScore: null,
      inspectedPages: 0,
      inspectedUrl: "https://example.com/",
      measuredCritical: 3,
      measuredWarnings: 7,
      issues: [],
    });

    expect(dashboard.healthScore).toBeNull();
    expect(dashboard.healthLabel).toBe("Score unavailable");
  });

  it("classifies every saved issue and gives it a plain-language next action", async () => {
    const dashboard = await buildAuditDashboard({
      healthScore: 48,
      inspectedPages: 1,
      inspectedUrl: "https://example.com/",
      measuredCritical: 2,
      measuredWarnings: 3,
      issues: [
        { code: "no_title", label: "Page title is missing", severity: "critical" },
        { code: "broken_links", label: "Page contains broken links", severity: "critical" },
        { code: "high_loading_time", label: "Page takes more than three seconds to load", severity: "warning" },
        { code: "is_http", label: "Page is not using HTTPS", severity: "warning" },
        { code: "has_micromarkup_errors", label: "Structured data contains errors", severity: "warning" },
      ],
    });

    expect(dashboard.issues.map((issue) => issue.category)).toEqual([
      "metadata-content",
      "links-redirects",
      "mobile-performance",
      "https-security",
      "structured-data",
    ]);
    expect(dashboard.issues.every((issue) => issue.whyItMatters && issue.nextAction)).toBe(true);
    expect(dashboard.categories.reduce((total, category) => total + category.total, 0)).toBe(5);
    expect(dashboard.isPartial).toBe(false);
  });

  it("prioritizes critical issues before warnings while preserving all details", async () => {
    const dashboard = await buildAuditDashboard({
      healthScore: 80,
      inspectedPages: 1,
      inspectedUrl: "https://example.com/",
      measuredCritical: 1,
      measuredWarnings: 2,
      issues: [
        { code: "no_image_alt", label: "Images are missing alt text", severity: "warning" },
        { code: "is_5xx_code", label: "Page returns a 5xx response", severity: "critical" },
        { code: "no_description", label: "Meta description is missing", severity: "warning" },
      ],
    });

    expect(dashboard.issues.map((issue) => issue.code)).toEqual(["is_5xx_code", "no_image_alt", "no_description"]);
    expect(dashboard.priorityIssues.map((issue) => issue.code)).toEqual(["is_5xx_code", "no_image_alt", "no_description"]);
    expect(dashboard.priorityIssue?.code).toBe("is_5xx_code");
    expect(dashboard.issueTotal).toBe(3);
  });
});
