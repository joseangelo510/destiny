import { afterEach, describe, expect, it, vi } from "vitest";
import { syncSearchConsole, syncYouTube } from "./google";

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
      const body = JSON.parse(String(init?.body)) as { dimensions?: string[] };
      if (body.dimensions?.includes("query")) {
        return response({ rows: [{ keys: ["best homes"], clicks: 7, impressions: 90, ctr: 0.077, position: 3.5 }] });
      }
      return response({ rows: [{ clicks: 42, impressions: 900, ctr: 0.0467, position: 8.2 }] });
    });

    const result = await syncSearchConsole("secret-access-token", "example.com");

    expect(result.externalAccountId).toBe("sc-domain:example.com");
    expect(result.metadata).toMatchObject({ clicks: 42, impressions: 900, position: 8.2 });
    expect(result.metadata.topQueries).toEqual([{ query: "best homes", clicks: 7, impressions: 90, position: 3.5 }]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const call of fetchMock.mock.calls) {
      expect((call[1]?.headers as Record<string, string>).Authorization).toBe("Bearer secret-access-token");
    }
  });

  it("parses YouTube channel and recent analytics without exposing credentials", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("youtube/v3/channels")) {
        return response({ items: [{ id: "channel-123", snippet: { title: "Destiny SEO" }, statistics: { subscriberCount: "1250", viewCount: "84000", videoCount: "41" } }] });
      }
      return response({ rows: [[3150, 12200, 88]] });
    });

    const result = await syncYouTube("another-secret-token");

    expect(result.externalAccountId).toBe("channel-123");
    expect(result.metadata).toMatchObject({ channelTitle: "Destiny SEO", subscribers: 1250, periodViews: 3150, estimatedMinutesWatched: 12200, subscribersGained: 88 });
    expect(JSON.stringify(result)).not.toContain("another-secret-token");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
