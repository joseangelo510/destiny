import { describe, expect, it } from "vitest";
import {
  evaluateCollectionFields,
  prepareToken,
  selectBodyField,
  webflowCollectionEndpoint,
  webflowCollectionsEndpoint,
  webflowSitesEndpoint,
} from "./logic";

const blogFields = [
  { slug: "name", displayName: "Name", type: "PlainText", isRequired: true, isEditable: true },
  { slug: "slug", displayName: "Slug", type: "PlainText", isRequired: true, isEditable: true },
  { slug: "post-body", displayName: "Post Body", type: "RichText", isEditable: true },
];

describe("Webflow connect Edge Function logic", () => {
  it("verifies tokens strictly", () => {
    expect(prepareToken(" abcdef0123456789abcdef0123456789 ")).toBe("abcdef0123456789abcdef0123456789");
    expect(() => prepareToken("short")).toThrow();
    expect(() => prepareToken(null)).toThrow();
  });

  it("evaluates collection compatibility server-side and never trusts the client mapping", () => {
    const compatible = evaluateCollectionFields(blogFields);
    expect(compatible.compatible).toBe(true);
    expect(selectBodyField(compatible, undefined)).toBe("post-body");
    expect(() => selectBodyField(compatible, "not-a-field")).toThrow();

    const noRichText = evaluateCollectionFields(blogFields.filter((field) => field.type !== "RichText"));
    expect(noRichText.compatible).toBe(false);
    expect(() => selectBodyField(noRichText, "post-body")).toThrow(/rich-text/);
  });

  it("only builds read endpoints for verification — no publish endpoints exist", () => {
    expect(webflowSitesEndpoint()).toBe("https://api.webflow.com/v2/sites");
    expect(webflowCollectionsEndpoint("site-1")).toBe("https://api.webflow.com/v2/sites/site-1/collections");
    expect(webflowCollectionEndpoint("col-1")).toBe("https://api.webflow.com/v2/collections/col-1");
    for (const endpoint of [webflowSitesEndpoint(), webflowCollectionsEndpoint("s"), webflowCollectionEndpoint("c")]) {
      expect(endpoint).not.toContain("publish");
    }
  });
});
