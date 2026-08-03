import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BacklinkAnalyticsWorkspace } from "./backlink-analytics-workspace";

describe("BacklinkAnalyticsWorkspace", () => {
  it("starts with a domain search and explains the report boundary", () => {
    const html = renderToStaticMarkup(<BacklinkAnalyticsWorkspace initialTarget="empowerly.com" />);
    expect(html).toContain("Destiny Link Intelligence");
    expect(html).toContain("Analyze backlinks");
    expect(html).toContain("individual links from unique referring domains");
  });
});
