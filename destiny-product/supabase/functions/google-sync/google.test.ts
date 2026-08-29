import { afterEach, describe, expect, it, vi } from "vitest";
import { syncGoogleAnalytics, syncSearchConsole, syncYouTube } from "./google";

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => vi.restoreAllMocks());

describe("Google read-only synchronization", () => {
  it("matches the requested Search Console domain and parses totals and query evidence", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/webmasters/v3/sites")) {
        return response({ siteEntry: [
          { siteUrl: "https://unrelated.example/", permissionLevel: "siteOwner" },
          { siteUrl: "sc-domain:example.com", permissionLevel: "siteFullUser" },
        ] });
      }
      const body = JSON.parse(String(init?.body)) as { dimensions?: string[]; endDate?: string };
      if (body.dimensions?.includes("query")) {
        return response({ rows: [{ keys: ["best homes"], clicks: 7, impressions: 90, ctr: 0.077, position: 3.5 }] });
      }
      if (body.dimensions?.includes("date")) {
        return response({ rows: [{ keys: [body.endDate], clicks: 5, impressions: 100, ctr: 0.05, position: 7.2 }] });
      }
      return response({ rows: [{ clicks: 42, impressions: 900, ctr: 0.0467, position: 8.2 }] });
    });

    const result = await syncSearchConsole("secret-access-token", "example.com");

    expect(result.externalAccountId).toBe("sc-domain:example.com");
    expect(result.metadata).toMatchObject({
      clicks: 42,
      impressions: 900,
      position: 8.2,
      periods: {
        "30": { clicks: 42, previousClicks: 42, impressions: 900, previousImpressions: 900 },
        "90": { clicks: 42, previousClicks: 42, impressions: 900, previousImpressions: 900 },
      },
    });
    expect(result.metadata.topQueries).toEqual([{ query: "best homes", clicks: 7, impressions: 90, position: 3.5 }]);
    expect(fetchMock).toHaveBeenCalledTimes(7);
    for (const call of fetchMock.mock.calls) {
      expect((call[1]?.headers as Record<string, string>).Authorization).toBe("Bearer secret-access-token");
    }
  });

  it("stores 30-day and 90-day Analytics journeys, daily trends, and traffic sources", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("accountSummaries")) {
        return response({ accountSummaries: [{ displayName: "Example", propertySummaries: [{ property: "properties/123", displayName: "Example site" }] }] });
      }
      if (url.includes("properties/123/dataStreams")) {
        return response({ dataStreams: [{ name: "properties/123/dataStreams/456", type: "WEB_DATA_STREAM", webStreamData: { defaultUri: "https://example.com" } }] });
      }
      const body = JSON.parse(String(init?.body ?? "{}")) as { requests?: unknown[]; dateRanges?: Array<{ startDate: string; endDate: string }> };
      if (url.includes("batchRunReports")) {
        const totals = (sessions: string, users: string, engaged: string, events: string) => ({ rows: [{ metricValues: [{ value: sessions }, { value: users }, { value: engaged }, { value: events }] }] });
        const date = String((body.requests?.[4] as { dateRanges?: Array<{ endDate?: string }> })?.dateRanges?.[0]?.endDate ?? "20260815").replaceAll("-", "");
        return response({ reports: [
          totals("60", "50", "42", "5"),
          totals("50", "44", "35", "3"),
          totals("180", "150", "126", "12"),
          totals("150", "130", "105", "9"),
          { rows: [{ dimensionValues: [{ value: date }], metricValues: [{ value: "4" }, { value: "3" }, { value: "2" }, { value: "1" }] }] },
        ] });
      }
      if (url.includes("runReport")) {
        return response({ rows: [
          { dimensionValues: [{ value: "google" }, { value: "organic" }], metricValues: [{ value: "80" }] },
          { dimensionValues: [{ value: "chatgpt.com" }, { value: "referral" }], metricValues: [{ value: "7" }] },
        ] });
      }
      return response({}, 404);
    });

    const result = await syncGoogleAnalytics("analytics-secret", "example.com");

    expect(result.externalAccountId).toBe("properties/123");
    expect(result.metadata).toMatchObject({
      organicSessions: 60,
      organicEngagedSessions: 42,
      organicKeyEvents: 5,
      periods: {
        "30": { organicSessions: 60, previousOrganicSessions: 50, organicEngagedSessions: 42, previousOrganicEngagedSessions: 35 },
        "90": { organicSessions: 180, previousOrganicSessions: 150, organicEngagedSessions: 126, previousOrganicEngagedSessions: 105 },
      },
    });
    expect((result.metadata.periods as Record<string, { trafficSources: unknown[] }>)["90"].trafficSources).toEqual([
      { source: "google", medium: "organic", sessions: 80 },
      { source: "chatgpt.com", medium: "referral", sessions: 7 },
    ]);
    expect(JSON.stringify(result)).not.toContain("analytics-secret");
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("parses YouTube channel and recent analytics without exposing credentials", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("youtube/v3/channels")) {
        return response({ items: [{ id: "channel-123", snippet: { title: "Rebound SEO SEO" }, statistics: { subscriberCount: "1250", viewCount: "84000", videoCount: "41" } }] });
      }
      return response({ rows: [[3150, 12200, 88]] });
    });

    const result = await syncYouTube("another-secret-token");

    expect(result.externalAccountId).toBe("channel-123");
    expect(result.metadata).toMatchObject({ channelTitle: "Rebound SEO SEO", subscribers: 1250, periodViews: 3150, estimatedMinutesWatched: 12200, subscribersGained: 88 });
    expect(JSON.stringify(result)).not.toContain("another-secret-token");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
