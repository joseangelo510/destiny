import { describe, expect, it } from "vitest";
import { derivePublishedState } from "./evidence";

describe("derivePublishedState", () => {
  it("constructs verified_live only from a machine source with a public receipt", () => {
    expect(derivePublishedState({ publicationStatus: "verified_live", publicUrl: "https://example.com/post", source: "crawl", verified: true })).toBe("verified_live");
  });

  it("refuses to construct verified_live from a user-reported input", () => {
    expect(derivePublishedState({ publicationStatus: "verified_live", publicUrl: "https://example.com/post", source: "user", verified: true })).toBe("published_unverified");
  });

  it("requires the explicit stored verified state and public URL", () => {
    expect(derivePublishedState({ publicationStatus: "published", publicUrl: "https://example.com/post", source: "cms", verified: true })).toBe("published_unverified");
    expect(derivePublishedState({ publicationStatus: "verified_live", publicUrl: null, source: "gsc", verified: true })).toBe("published_unverified");
  });
});
