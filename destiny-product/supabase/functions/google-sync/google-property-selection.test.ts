import { afterEach, describe, expect, it, vi } from "vitest";
import { syncGoogleAnalytics, syncSearchConsole } from "./google";

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => vi.restoreAllMocks());

describe("site-bound Google property selection", () => {
  it("fails closed instead of using the first unrelated Search Console property", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => response({ siteEntry: [
      { siteUrl: "sc-domain:other.example", permissionLevel: "siteOwner" },
      { siteUrl: "https://another.example/", permissionLevel: "siteOwner" },
    ] }));

    await expect(syncSearchConsole("token", "example.com")).rejects.toThrow("No Search Console property matches example.com");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("requires an explicit choice when two Search Console resources match the website", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => response({ siteEntry: [
      { siteUrl: "sc-domain:example.com", permissionLevel: "siteOwner" },
      { siteUrl: "https://example.com/", permissionLevel: "siteFullUser" },
    ] }));

    const result = await syncSearchConsole("token", "example.com");

    expect(result.externalAccountId).toBeNull();
    expect(result.metadata).toMatchObject({
      selectionRequired: true,
      requestedDomain: "example.com",
      availableSites: [
        { siteUrl: "sc-domain:example.com", matchesWebsite: true },
        { siteUrl: "https://example.com/", matchesWebsite: true },
      ],
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("discovers the GA4 web stream that matches the website instead of taking property zero", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("accountSummaries")) return response({ accountSummaries: [{ displayName: "Agency", propertySummaries: [
        { property: "properties/111", displayName: "Wrong site" },
        { property: "properties/222", displayName: "Example site" },
      ] }] });
      if (url.includes("properties/111/dataStreams")) return response({ dataStreams: [{ type: "WEB_DATA_STREAM", webStreamData: { defaultUri: "https://wrong.example" } }] });
      if (url.includes("properties/222/dataStreams")) return response({ dataStreams: [{ type: "WEB_DATA_STREAM", webStreamData: { defaultUri: "https://example.com" } }] });
      if (url.includes("batchRunReports")) return response({ reports: [{}, {}, {}, {}, {}] });
      if (url.includes("runReport")) return response({ rows: [] });
      return response({}, 404);
    });

    const result = await syncGoogleAnalytics("token", "example.com");

    expect(result.externalAccountId).toBe("properties/222");
    expect(result.metadata).toMatchObject({ selectedProperty: { property: "properties/222", matchedDomain: "example.com" } });
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("properties/111:batchRunReports"))).toBe(false);
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("properties/222:batchRunReports"))).toBe(true);
  });

  it("refuses a requested GA4 property whose web stream belongs to another site", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("accountSummaries")) return response({ accountSummaries: [{ displayName: "Agency", propertySummaries: [
        { property: "properties/111", displayName: "Wrong site" },
        { property: "properties/222", displayName: "Example site" },
      ] }] });
      if (url.includes("properties/111/dataStreams")) return response({ dataStreams: [{ type: "WEB_DATA_STREAM", webStreamData: { defaultUri: "https://wrong.example" } }] });
      if (url.includes("properties/222/dataStreams")) return response({ dataStreams: [{ type: "WEB_DATA_STREAM", webStreamData: { defaultUri: "https://example.com" } }] });
      return response({}, 404);
    });

    await expect(syncGoogleAnalytics("token", "example.com", "properties/111")).rejects.toThrow("does not match example.com");
  });
});
