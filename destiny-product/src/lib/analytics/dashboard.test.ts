import { describe, expect, it } from "vitest";
import { buildAnalyticsPeriods, buildRankMovers } from "./dashboard";

describe("Destiny analytics dashboard", () => {
  it("keeps Search Console and Analytics metrics in a truthful search journey", () => {
    const periods = buildAnalyticsPeriods({
      searchConsole: { periods: { 90: {
        clicks: 180, previousClicks: 150, impressions: 4200, previousImpressions: 3500,
        daily: [{ date: "2026-08-17", clicks: 10, impressions: 250 }],
        previousDaily: [{ date: "2026-05-18", clicks: 8, impressions: 220 }],
      } } },
      analytics: { periods: { 90: {
        organicSessions: 160, previousOrganicSessions: 140,
        organicEngagedSessions: 120, previousOrganicEngagedSessions: 100,
        daily: [{ date: "2026-08-17", organicSessions: 9, organicEngagedSessions: 7 }],
        previousDaily: [{ date: "2026-05-18", organicSessions: 7, organicEngagedSessions: 5 }],
        trafficSources: [
          { source: "google", medium: "organic", sessions: 80 },
          { source: "chatgpt.com", medium: "referral", sessions: 10 },
          { source: "(direct)", medium: "(none)", sessions: 10 },
        ],
      } } },
      movers: [{ keyword: "seo coach", currentPosition: 8, previousPosition: 13, delta: 5, tone: "up" }],
    });

    expect(periods[90].metrics.impressions).toMatchObject({ total: 4200, previousTotal: 3500, changePercent: 20, source: "Google Search Console" });
    expect(periods[90].metrics.clicks.changePercent).toBe(20);
    expect(periods[90].metrics.engagedVisits).toMatchObject({ total: 120, name: "Engaged visits", source: "Google Analytics" });
    expect(periods[90].trafficSources).toEqual([
      { label: "Organic search", sessions: 80, percent: 80 },
      { label: "AI assistants", sessions: 10, percent: 10 },
      { label: "Direct", sessions: 10, percent: 10 },
    ]);
    expect(periods[90].verdict).toBe("More people are finding you on Google — visibility grew +20% and search visits grew +20%, with 1 tracked keyword that moved onto page one.");
    expect(periods[90].verdictSegments.filter((segment) => segment.highlight).map((segment) => segment.text)).toEqual([
      "+20%",
      "+20%",
      "1 tracked keyword",
    ]);
  });

  it("keeps a mixed-period verdict truthful while preserving the highlighted metric structure", () => {
    const periods = buildAnalyticsPeriods({
      searchConsole: { periods: { 30: {
        clicks: 80,
        previousClicks: 100,
        impressions: 1200,
        previousImpressions: 1000,
      } } },
      analytics: null,
      movers: [],
    });

    expect(periods[30].verdict).toBe("Your Google visibility grew +20%, while search visits fell −20%.");
    expect(periods[30].verdictSegments.filter((segment) => segment.highlight).map((segment) => segment.text)).toEqual(["+20%", "−20%"]);
  });

  it("uses legacy 28-day snapshots only for the 30-day view and does not invent a 90-day series", () => {
    const periods = buildAnalyticsPeriods({
      searchConsole: { clicks: 42, impressions: 900 },
      analytics: { organicSessions: 30, organicActiveUsers: 22, organicKeyEvents: 2 },
    });

    expect(periods[30].metrics.clicks.total).toBe(42);
    expect(periods[30].metrics.engagedVisits).toMatchObject({ total: 30, name: "Organic visits" });
    expect(periods[90].metrics.clicks.total).toBeNull();
    expect(periods[90].hasFirstPartyTrend).toBe(false);
  });

  it("builds website-scoped rank movers from the latest two supplied observations", () => {
    const movers = buildRankMovers(
      [{ id: "alpha", keyword: "background check service" }, { id: "beta", keyword: "tenant screening" }],
      [
        { tracked_keyword_id: "alpha", observed_at: "2026-08-18", found: true, position: 8 },
        { tracked_keyword_id: "alpha", observed_at: "2026-08-11", found: true, position: 15 },
        { tracked_keyword_id: "beta", observed_at: "2026-08-18", found: true, position: 21 },
        { tracked_keyword_id: "beta", observed_at: "2026-08-11", found: true, position: 18 },
        { tracked_keyword_id: "other-site", observed_at: "2026-08-18", found: true, position: 1 },
      ],
    );

    expect(movers).toEqual([
      { keyword: "background check service", currentPosition: 8, previousPosition: 15, delta: 7, tone: "up" },
      { keyword: "tenant screening", currentPosition: 21, previousPosition: 18, delta: -3, tone: "down" },
    ]);
  });
});
