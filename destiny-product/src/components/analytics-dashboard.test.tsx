import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AnalyticsDashboard } from "./analytics-dashboard";
import { buildAnalyticsPeriods } from "@/lib/analytics/dashboard";

const action = { title: "Review the page that just reached position eight.", href: "/rank-tracker", label: "Review ranking" };

describe("AnalyticsDashboard", () => {
  it("renders the approved verdict-first hierarchy from connected first-party data", () => {
    const periods = buildAnalyticsPeriods({
      searchConsole: { periods: { 90: {
        impressions: 4200,
        previousImpressions: 3500,
        clicks: 180,
        previousClicks: 150,
        daily: [{ date: "2026-08-17", impressions: 210, clicks: 12 }, { date: "2026-08-18", impressions: 240, clicks: 15 }],
        previousDaily: [{ date: "2026-05-18", impressions: 170, clicks: 8 }, { date: "2026-05-19", impressions: 190, clicks: 9 }],
      } } },
      analytics: { periods: { 90: {
        organicEngagedSessions: 120,
        previousOrganicEngagedSessions: 100,
        daily: [{ date: "2026-08-17", organicEngagedSessions: 7 }, { date: "2026-08-18", organicEngagedSessions: 9 }],
        previousDaily: [{ date: "2026-05-18", organicEngagedSessions: 5 }, { date: "2026-05-19", organicEngagedSessions: 6 }],
        trafficSources: [{ source: "google", medium: "organic", sessions: 80 }],
      } } },
    });
    const html = renderToStaticMarkup(<AnalyticsDashboard
      estimate={{ organicTraffic: 900, rankingKeywords: 48, source: "DataForSEO" }}
      nextAction={action}
      periods={periods}
      rankMovers={[{ keyword: "seo coach", currentPosition: 8, previousPosition: 13, delta: 5, tone: "up" }]}
      sources={[
        { label: "Google Search Console", detail: "synced 1h ago", connected: true },
        { label: "Google Analytics", detail: "synced 1h ago", connected: true },
        { label: "Conversions", detail: "0 organic key events", connected: false },
      ]}
      trackedKeywordCount={8}
    />);

    expect(html).toContain("This period, in one sentence");
    expect(html).toContain("Do this next");
    expect(html).toContain("The search journey");
    expect(html).toContain("Where visitors come from");
    expect(html).toContain("Keywords that moved");
    expect(html).toContain("No organic conversions are recorded yet");
    expect(html).toContain("Provider estimates—not website Analytics");
    expect(html.indexOf("This period, in one sentence")).toBeLessThan(html.indexOf("The search journey"));
  });

  it("disables the 90-day control instead of inventing a range from legacy totals", () => {
    const periods = buildAnalyticsPeriods({
      searchConsole: { clicks: 42, impressions: 900 },
      analytics: { organicSessions: 30 },
    });
    const html = renderToStaticMarkup(<AnalyticsDashboard
      estimate={null}
      nextAction={action}
      periods={periods}
      rankMovers={[]}
      sources={[]}
      trackedKeywordCount={0}
    />);

    expect(html).toContain("Last 90 days</button>");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Last 90 days<\/button>/);
    expect(html).toContain("Trend appears after the next data sync");
  });
});
