import { describe, expect, it } from "vitest";
import { buildHomeCompetitorSummary } from "./home-competitor-summary";

describe("Rebound Home competitor evidence", () => {
  it("joins saved competitors to the latest DataForSEO receipt and includes discovered search competitors", () => {
    const summary = buildHomeCompetitorSummary({
      websiteLabel: "Jose Angelo Studios",
      saved: [{ name: "Victorious", url: "https://victorious.com" }],
      providerResult: {
        source: "dataforseo",
        sourceLabel: "Live DataForSEO audit",
        fetchedAt: "2026-09-01T18:30:00Z",
        competitors: [
          { domain: "victorious.com", sharedKeywords: 42 },
          { domain: "searchcompetitor.example", sharedKeywords: 17 },
        ],
      },
    });

    expect(summary).toMatchObject({
      sourceLabel: "Live DataForSEO audit",
      fetchedAt: "2026-09-01T18:30:00Z",
      competitors: [
        { name: "Victorious", domain: "victorious.com", relationship: "Saved competitor", sharedKeywords: 42 },
        { name: "searchcompetitor.example", domain: "searchcompetitor.example", relationship: "Search competitor", sharedKeywords: 17 },
      ],
    });
  });

  it("does not turn a saved competitor into measured evidence when the provider did not return it", () => {
    const summary = buildHomeCompetitorSummary({
      websiteLabel: "Example",
      saved: [{ name: "Named competitor", url: "https://named.example" }],
      providerResult: { source: "dataforseo", competitors: [] },
    });

    expect(summary.competitors[0]).toMatchObject({
      relationship: "Saved competitor",
      sharedKeywords: null,
    });
  });
});
