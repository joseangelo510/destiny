import { describe, expect, it } from "vitest";
import { buildPublicationReceipt } from "./publication-receipt";

describe("canonical publication receipt", () => {
  it("recognizes a draft as delivered but never live", () => {
    expect(buildPublicationReceipt({
      provider: "wordpress",
      articleKey: "audit:commercial-junk-removal",
      publicationStatus: "delivered_draft",
      remoteEditUrl: "https://example.com/wp-admin/post.php?post=42&action=edit",
      remotePermalink: "https://example.com/commercial-junk-removal/",
    })).toMatchObject({
      stage: "draft_delivered",
      label: "Draft delivered",
      canShare: false,
      canonicalUrl: null,
    });
  });

  it("requires complete public evidence before verified live can be shared", () => {
    expect(buildPublicationReceipt({
      provider: "wordpress",
      articleKey: "audit:commercial-junk-removal",
      publicationStatus: "verified_live",
      remotePermalink: "https://example.com/commercial-junk-removal/",
      verifiedLiveAt: "2026-08-23T20:00:00.000Z",
      verificationEvidence: {
        verified: true,
        httpStatus: 200,
        canonicalMatches: true,
        contentMatches: true,
        indexable: true,
      },
    })).toMatchObject({
      stage: "live_verified",
      label: "Verified live",
      canShare: true,
      canonicalUrl: "https://example.com/commercial-junk-removal/",
      verifiedLiveAt: "2026-08-23T20:00:00.000Z",
    });
  });

  it.each([
    { remotePermalink: null, verifiedLiveAt: "2026-08-23T20:00:00.000Z", verificationEvidence: { verified: true, httpStatus: 200, canonicalMatches: true, contentMatches: true, indexable: true } },
    { remotePermalink: "http://example.com/article", verifiedLiveAt: "2026-08-23T20:00:00.000Z", verificationEvidence: { verified: true, httpStatus: 200, canonicalMatches: true, contentMatches: true, indexable: true } },
    { remotePermalink: "https://example.com/article", verifiedLiveAt: null, verificationEvidence: { verified: true, httpStatus: 200, canonicalMatches: true, contentMatches: true, indexable: true } },
    { remotePermalink: "https://example.com/article", verifiedLiveAt: "2026-08-23T20:00:00.000Z", verificationEvidence: { verified: true, httpStatus: 200, canonicalMatches: false, contentMatches: true, indexable: true } },
  ])("downgrades incomplete verified-live evidence", (input) => {
    expect(buildPublicationReceipt({
      provider: "wordpress",
      articleKey: "audit:commercial-junk-removal",
      publicationStatus: "verified_live",
      ...input,
    })).toMatchObject({
      stage: "published_unverified",
      canShare: false,
      canonicalUrl: null,
    });
  });
});
