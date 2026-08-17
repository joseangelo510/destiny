import { describe, expect, it } from "vitest";
import {
  publicationCopy,
  verifyPublicWordPressPage,
  type CmsPublicationState,
} from "./publication-state";

describe("CMS publication state", () => {
  it.each<[CmsPublicationState, string]>([
    ["delivered_draft", "Draft delivered"],
    ["scheduled", "Scheduled"],
    ["published_unverified", "Published — checking"],
    ["verified_live", "Verified live"],
    ["changed_in_cms", "Changed in WordPress"],
    ["verification_failed", "Published — needs review"],
  ])("uses plain, truthful copy for %s", (state, label) => {
    expect(publicationCopy(state).label).toBe(label);
  });
});

describe("public WordPress verification", () => {
  const expected = {
    permalink: "https://example.com/guides/useful-guide/",
    title: "A Useful Guide",
    fingerprint: "a useful guide practical opening paragraph",
  };

  it("requires a successful response, canonical match, content match, and indexability", () => {
    const html = `<!doctype html><html><head><title>A Useful Guide - Example</title><link rel="canonical" href="https://example.com/guides/useful-guide/"></head><body><h1>A Useful Guide</h1><p>Practical opening paragraph</p></body></html>`;
    expect(verifyPublicWordPressPage({ status: 200, html, ...expected })).toMatchObject({
      verified: true,
      renderedTitle: "A Useful Guide - Example",
      canonicalMatches: true,
      contentMatches: true,
      indexable: true,
    });
  });

  it.each([
    { status: 404, html: "", reason: "The public URL returned HTTP 404." },
    { status: 200, html: '<meta name="robots" content="noindex"><link rel="canonical" href="https://example.com/guides/useful-guide/">A Useful Guide Practical opening paragraph', reason: "The published page is marked noindex." },
    { status: 200, html: '<link rel="canonical" href="https://other.example/page">A Useful Guide Practical opening paragraph', reason: "The canonical URL does not match the WordPress permalink." },
    { status: 200, html: '<link rel="canonical" href="https://example.com/guides/useful-guide/">Different article', reason: "The public page does not contain the delivered article fingerprint." },
  ])("does not claim verification when a public check fails", ({ status, html, reason }) => {
    expect(verifyPublicWordPressPage({ status, html, ...expected })).toMatchObject({ verified: false, reason });
  });
});
