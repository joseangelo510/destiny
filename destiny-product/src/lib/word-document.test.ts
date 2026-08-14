import { describe, expect, it } from "vitest";
import { createDocxFromHtml, safeDocumentName } from "./word-document";

describe("real Word document generation", () => {
  it("creates an Open XML package rather than HTML renamed as .doc", async () => {
    const document = await createDocxFromHtml(`<!doctype html><html><body><h1>Main title</h1><h4>Detailed heading</h4><p>Paragraph with <strong>bold text</strong> and a <a href="https://example.com">source link</a>.</p><ul><li>First step</li></ul></body></html>`, "Destiny export test");
    expect(document.subarray(0, 2).toString()).toBe("PK");
    expect(document.includes(Buffer.from("word/document.xml"))).toBe(true);
    expect(document.byteLength).toBeGreaterThan(5_000);
  });

  it("creates safe Word filenames", () => {
    expect(safeDocumentName("YouTube SEO: A Better Plan")).toBe("youtube-seo-a-better-plan");
  });
});
