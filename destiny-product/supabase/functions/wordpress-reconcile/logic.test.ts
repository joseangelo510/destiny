import { describe, expect, it } from "vitest";
import { fingerprintFromRemote, fingerprintMatches, publicationState, scheduleItemTransition, verifyPublicPage } from "./logic";

describe("WordPress reconciliation", () => {
  it("advances only a verified live scheduled item to published", () => {
    expect(scheduleItemTransition("scheduled", "verified_live")).toEqual({ to: "published" });
    for (const status of ["published_unverified", "delivered_draft", "changed_in_cms", "stale", "unpublished", "verification_failed"]) {
      expect(scheduleItemTransition("scheduled", status)).toBeNull();
    }
  });

  it("is idempotent once the schedule item is already published", () => {
    expect(scheduleItemTransition("published", "verified_live")).toBeNull();
    expect(scheduleItemTransition("needs_review", "verified_live")).toBeNull();
  });

  it.each([
    ["draft", true, undefined, "delivered_draft"],
    ["draft", false, undefined, "changed_in_cms"],
    ["future", true, undefined, "scheduled"],
    ["publish", true, true, "verified_live"],
    ["publish", true, false, "verification_failed"],
    ["trash", true, undefined, "unpublished"],
  ])("maps %s to a truthful state", (remote, content, verified, expected) => {
    expect(publicationState(remote as string, content as boolean, verified as boolean | undefined)).toBe(expected);
  });

  it("recognizes the delivered content after WordPress formatting changes", () => {
    expect(fingerprintMatches("<h1>A useful guide</h1><p>Practical opening paragraph.</p>", "a useful guide practical opening paragraph")).toBe(true);
  });

  it("builds a bounded legacy fingerprint from the authenticated WordPress article", () => {
    expect(fingerprintFromRemote("FCRA-Compliant Background Checks", "<p>A practical employer guide.</p>"))
      .toBe("fcra compliant background checks a practical employer guide");
  });

  it("verifies the public page using canonical, fingerprint, and robots evidence", () => {
    expect(verifyPublicPage({
      status: 200,
      permalink: "https://example.com/useful-guide/",
      fingerprint: "a useful guide practical opening paragraph",
      html: '<title>A Useful Guide - Example</title><link rel="canonical" href="https://example.com/useful-guide/"><h1>A useful guide</h1><p>Practical opening paragraph.</p>',
    })).toMatchObject({ verified: true, renderedTitle: "A Useful Guide - Example" });
  });

  it("fails closed when a new transfer is missing its required featured or inline media", () => {
    const result = verifyPublicPage({
      status: 200,
      permalink: "https://example.com/useful-guide/",
      fingerprint: "a useful guide practical opening paragraph",
      expectedInlineImages: 1,
      featuredImageRequired: true,
      html: '<title>A Useful Guide</title><link rel="canonical" href="https://example.com/useful-guide/"><h1>A useful guide</h1><p>Practical opening paragraph.</p>',
    });
    expect(result).toMatchObject({ verified: false, mediaVerified: false });
    expect(result.reason).toMatch(/featured image/i);
  });

  it("verifies featured metadata, inline image count, and alt text for new transfers", () => {
    const result = verifyPublicPage({
      status: 200,
      permalink: "https://example.com/useful-guide/",
      fingerprint: "a useful guide practical opening paragraph",
      expectedInlineImages: 1,
      featuredImageRequired: true,
      html: '<title>A Useful Guide</title><link rel="canonical" href="https://example.com/useful-guide/"><meta property="og:image" content="https://example.com/featured.webp"><h1>A useful guide</h1><p>Practical opening paragraph.</p><div class="entry-content"><figure class="wp-block-image destiny-article-figure"><img src="https://example.com/inline.webp" alt="Useful diagram"></figure></div>',
    });
    expect(result).toMatchObject({ verified: true, mediaVerified: true, inlineImageCount: 1 });
  });
});
