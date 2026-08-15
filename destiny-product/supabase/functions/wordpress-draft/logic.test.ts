import { describe, expect, it } from "vitest";
import { contentFingerprint, insertWordPressFigures, prepareDraftBody, wordpressDraftPayload, wordpressEditUrl } from "./logic";

describe("WordPress draft Edge Function logic", () => {
  it("hard-codes draft status and creates the editor link", () => {
    const draft = prepareDraftBody({
      websiteId: "website-1",
      articleKey: "audit-1:keyword",
      title: "A useful article",
      metaTitle: "A Useful Article | Practical Guide",
      contentHtml: `<h1>A useful article</h1><p>${"Safe article content. ".repeat(8)}</p>`,
      excerpt: "A concise summary.",
    });
    expect(wordpressDraftPayload(draft)).toMatchObject({ status: "draft", title: "A useful article" });
    expect(draft.metaTitle).toBe("A Useful Article | Practical Guide");
    expect(wordpressDraftPayload(draft)).not.toHaveProperty("publish");
    expect(wordpressEditUrl("https://example.com/", "42")).toBe("https://example.com/wp-admin/post.php?post=42&action=edit");
  });

  it("adds uploaded graphics after article sections and uses the first as featured media", () => {
    const draft = prepareDraftBody({
      websiteId: "website-1",
      articleKey: "audit-1:keyword",
      title: "A useful article",
      contentHtml: `<p>${"Opening content. ".repeat(8)}</p><h2>First section</h2><p>One</p><h2>Second section</h2><p>Two</p>`,
      excerpt: "A concise summary.",
    });
    const media = [
      { id: 20, sourceUrl: "https://example.com/uploads/first.webp", alt: "First graphic" },
      { id: 21, sourceUrl: "https://example.com/uploads/second.webp", alt: "Second graphic" },
    ];
    const content = insertWordPressFigures(draft.contentHtml, media);
    expect(content).toContain('<figure class="wp-block-image"><img src="https://example.com/uploads/first.webp" alt="First graphic" /></figure>');
    expect(content.indexOf("first.webp")).toBeGreaterThan(content.indexOf("First section"));
    expect(content.indexOf("second.webp")).toBeGreaterThan(content.indexOf("Second section"));
    expect(wordpressDraftPayload(draft, media)).toMatchObject({ status: "draft", featured_media: 20, content });
  });

  it("creates a stable, short fingerprint from the article text", () => {
    expect(contentFingerprint("A Useful Article", "<p>Practical <strong>opening</strong> paragraph.</p>"))
      .toBe("a useful article practical opening paragraph");
  });

  it("rejects an incomplete draft", () => {
    expect(() => prepareDraftBody({ websiteId: "website-1", articleKey: "article", title: "Title", contentHtml: "short" })).toThrow();
  });
});
