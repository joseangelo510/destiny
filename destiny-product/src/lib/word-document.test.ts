import { describe, expect, it } from "vitest";
import { createDocxFromHtml, safeDocumentName } from "./word-document";
import mammoth from "mammoth";

describe("real Word document generation", () => {
  it("creates an Open XML package rather than HTML renamed as .doc", async () => {
    const document = await createDocxFromHtml(`<!doctype html><html><body><h1>Main title</h1><h4>Detailed heading</h4><p>Paragraph with <strong>bold text</strong> and a <a href="https://example.com">source link</a>.</p><ul><li>First step</li></ul></body></html>`, "Rebound SEO export test");
    expect(document.subarray(0, 2).toString()).toBe("PK");
    expect(document.includes(Buffer.from("word/document.xml"))).toBe(true);
    expect(document.byteLength).toBeGreaterThan(5_000);
  });

  it("creates safe Word filenames", () => {
    expect(safeDocumentName("YouTube SEO: A Better Plan")).toBe("youtube-seo-a-better-plan");
  });

  it("strips untrusted remote images before inserting a server-generated graphic", async () => {
    const document = await createDocxFromHtml('<html><body><p>Article</p><img src="https://example.com/tracker.png"></body></html>', "Safe export", [{
      png: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+p0V8AAAAASUVORK5CYII=", "base64"),
      title: "Reviewed",
      altText: "Reviewed graphic",
      caption: "Source: article research",
      displayHeight: 1,
    }]);
    const converted = await mammoth.convertToHtml({ buffer: document });
    expect(converted.value.match(/<img\b/g)).toHaveLength(1);
    expect(converted.value).not.toContain("example.com/tracker.png");
  });
});
