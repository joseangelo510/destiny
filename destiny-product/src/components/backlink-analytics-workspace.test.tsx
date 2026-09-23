import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BacklinkAnalyticsWorkspace } from "./backlink-analytics-workspace";

describe("BacklinkAnalyticsWorkspace", () => {
  it("starts with a domain search and explains the report boundary", () => {
    const html = renderToStaticMarkup(<BacklinkAnalyticsWorkspace initialTarget="empowerly.com" />);
    expect(html).toContain("Rebound SEO Link Intelligence");
    expect(html).toContain("Analyze backlinks");
    expect(html).toContain("individual links from unique referring domains");
  });

  it("shows the exact domain-report allowance before a backlink request", () => {
    const html = renderToStaticMarkup(<BacklinkAnalyticsWorkspace initialTarget="clearcheck.app" domainReportAllowance={{ used: 6, limit: 25 }} />);
    expect(html).toContain("Uses 1 Domain report");
    expect(html).toContain("19 remaining");
    expect(html).toContain("6 of 25 used");
  });

  it("names the consumed allowance without inventing a remaining balance when billing is unavailable", () => {
    const html = renderToStaticMarkup(<BacklinkAnalyticsWorkspace initialTarget="clearcheck.app" />);
    expect(html).toContain("Uses 1 Domain report");
    expect(html).toContain("Check billing for your remaining allowance");
    expect(html).not.toContain("0 remaining");
  });
});
