import { describe, expect, it } from "vitest";
import { evaluateWebflowCollection, prepareWebflowToken, resolveWebflowBodyField } from "./webflow";

const name = { slug: "name", displayName: "Name", type: "PlainText", isRequired: true, isEditable: true };
const slug = { slug: "slug", displayName: "Slug", type: "PlainText", isRequired: true, isEditable: true };
const richBody = { slug: "post-body", displayName: "Post Body", type: "RichText", isRequired: false, isEditable: true };

describe("prepareWebflowToken", () => {
  it("accepts a trimmed site token", () => {
    expect(prepareWebflowToken("  abcdef0123456789abcdef0123456789  ")).toBe("abcdef0123456789abcdef0123456789");
  });

  it("rejects empty, short, or whitespace-containing tokens", () => {
    expect(() => prepareWebflowToken("")).toThrow();
    expect(() => prepareWebflowToken("short-token")).toThrow();
    expect(() => prepareWebflowToken("abcdef0123456789 abcdef0123456789")).toThrow();
    expect(() => prepareWebflowToken(42)).toThrow();
  });
});

describe("evaluateWebflowCollection", () => {
  it("accepts a blog-style collection and maps title and body", () => {
    const evaluation = evaluateWebflowCollection([name, slug, richBody]);
    expect(evaluation).toEqual({
      compatible: true,
      mapping: { titleField: "name", bodyFields: [{ slug: "post-body", label: "Post Body" }] },
    });
  });

  it("refuses a collection without a rich-text field", () => {
    const evaluation = evaluateWebflowCollection([name, slug, { slug: "summary", displayName: "Summary", type: "PlainText" }]);
    expect(evaluation.compatible).toBe(false);
    if (!evaluation.compatible) expect(evaluation.reason).toContain("rich-text");
  });

  it("refuses a collection missing the built-in name field", () => {
    const evaluation = evaluateWebflowCollection([richBody]);
    expect(evaluation.compatible).toBe(false);
    if (!evaluation.compatible) expect(evaluation.reason).toContain("name field");
  });

  it("refuses a collection whose other required fields Rebound SEO cannot fill", () => {
    const evaluation = evaluateWebflowCollection([name, slug, richBody, { slug: "hero-image", displayName: "Hero Image", type: "Image", isRequired: true, isEditable: true }]);
    expect(evaluation.compatible).toBe(false);
    if (!evaluation.compatible) expect(evaluation.reason).toContain("Hero Image");
  });

  it("ignores required fields that are not editable", () => {
    const evaluation = evaluateWebflowCollection([name, slug, richBody, { slug: "computed", displayName: "Computed", type: "PlainText", isRequired: true, isEditable: false }]);
    expect(evaluation.compatible).toBe(true);
  });
});

describe("resolveWebflowBodyField", () => {
  it("defaults to the first rich-text field and honors a valid choice", () => {
    const evaluation = evaluateWebflowCollection([name, slug, richBody, { slug: "extended-body", displayName: "Extended Body", type: "RichText", isEditable: true }]);
    expect(resolveWebflowBodyField(evaluation, undefined)).toBe("post-body");
    expect(resolveWebflowBodyField(evaluation, "extended-body")).toBe("extended-body");
  });

  it("rejects a body field that is not one of the collection's rich-text fields", () => {
    const evaluation = evaluateWebflowCollection([name, slug, richBody]);
    expect(() => resolveWebflowBodyField(evaluation, "summary")).toThrow();
  });

  it("rethrows the incompatibility reason for incompatible collections", () => {
    const evaluation = evaluateWebflowCollection([name, slug]);
    expect(() => resolveWebflowBodyField(evaluation, undefined)).toThrow(/rich-text/);
  });
});
