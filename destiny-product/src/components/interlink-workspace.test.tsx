import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InterlinkWorkspace, type InterlinkOpportunityView } from "./interlink-workspace";

const opportunity: InterlinkOpportunityView = {
  id: "opportunity-1",
  sourceUrl: "https://example.com/pricing",
  sourceTitle: "Pricing",
  targetUrl: "https://example.com/services/seo",
  targetTitle: "SEO services",
  anchorText: "SEO services",
  sourceSentence: "Our SEO services help founders build durable demand.",
  reason: "This relevant page can strengthen a page already ranking #8.",
  priority: "high",
  score: 58,
  status: "suggested",
  verifiedAt: null,
  verifiedAnchor: null,
};

describe("InterlinkWorkspace", () => {
  it("explains the bounded scan and presents one clear action per opportunity", () => {
    const html = renderToStaticMarkup(<InterlinkWorkspace
      websiteId="website-1"
      websiteName="Example Co"
      initialRun={{ id: "run-1", pagesChecked: 8, inventoryCount: 10, completedAt: "2026-08-21T20:00:00.000Z", scope: "verified_priority_pages" }}
      initialOpportunities={[opportunity]}
    />);
    expect(html).toContain("verified priority pages—not every URL");
    expect(html).toContain("Pricing");
    expect(html).toContain("SEO services");
    expect(html).toContain("Get the edit");
    expect(html).not.toContain("Apply automatically");
  });

  it("does not present a claimed implementation as verified", () => {
    const html = renderToStaticMarkup(<InterlinkWorkspace
      websiteId="website-1"
      websiteName="Example Co"
      initialRun={{ id: "run-1", pagesChecked: 8, inventoryCount: 10, completedAt: "2026-08-21T20:00:00.000Z", scope: "verified_priority_pages" }}
      initialOpportunities={[{ ...opportunity, status: "done_claimed" }]}
    />);
    expect(html).toContain("Waiting for verification");
    expect(html).toContain("Verify link");
    expect(html).not.toContain("Live link confirmed");
  });
});
