import { describe, expect, it } from "vitest";
import { fingerprintMatches, publicationState, verifyPublicPage } from "./logic";

describe("WordPress reconciliation", () => {
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

  it("verifies the public page using canonical, fingerprint, and robots evidence", () => {
    expect(verifyPublicPage({
      status: 200,
      permalink: "https://example.com/useful-guide/",
      fingerprint: "a useful guide practical opening paragraph",
      html: '<title>A Useful Guide - Example</title><link rel="canonical" href="https://example.com/useful-guide/"><h1>A useful guide</h1><p>Practical opening paragraph.</p>',
    })).toMatchObject({ verified: true, renderedTitle: "A Useful Guide - Example" });
  });
});
