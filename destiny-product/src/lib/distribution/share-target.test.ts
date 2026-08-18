import { describe, expect, it } from "vitest";
import { latestVerifiedShareTarget } from "./share-target";

describe("latestVerifiedShareTarget", () => {
  it("uses only the latest verified published article for the selected website", () => {
    expect(latestVerifiedShareTarget([
      { articleKey: "audit:older-article", publicationStatus: "published", remotePermalink: "https://example.com/older", verifiedLiveAt: "2026-08-10T12:00:00Z" },
      { articleKey: "audit:newer-article", publicationStatus: "published", remotePermalink: "https://example.com/newer", verifiedLiveAt: "2026-08-12T12:00:00Z" },
      { articleKey: "audit:draft", publicationStatus: "delivered_draft", remotePermalink: "https://example.com/draft", verifiedLiveAt: "2026-08-13T12:00:00Z" },
    ], "https://example.com", "Example Co")).toEqual({
      url: "https://example.com/newer",
      title: "New from Example Co: newer article",
      verifiedArticle: true,
    });
  });

  it("falls back honestly to the selected website when no article is verified live", () => {
    expect(latestVerifiedShareTarget([{ publicationStatus: "published", remotePermalink: "https://example.com/unverified" }], "https://example.com", "Example Co")).toEqual({
      url: "https://example.com",
      title: "Explore Example Co",
      verifiedArticle: false,
    });
  });
});
