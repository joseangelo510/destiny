import { describe, expect, it } from "vitest";
import { canUpdateWordPressDraft, contentFingerprint, insertWordPressFigures, prepareDraftBody, verifyDeliveredDraftMedia, wordpressDraftPayload, wordpressEditUrl, wordpressPostEndpoint } from "./logic";

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
    expect(draft.renderingVersion).toBe("wordpress-blocks-v1");
    expect(draft.metaTitle).toBe("A Useful Article | Practical Guide");
    expect(wordpressDraftPayload(draft)).not.toHaveProperty("publish");
    expect(wordpressEditUrl("https://example.com/", "42")).toBe("https://example.com/wp-admin/post.php?post=42&action=edit");
    expect(wordpressPostEndpoint("https://example.com/", "42")).toBe("https://example.com/wp-json/wp/v2/posts/42");
    expect(wordpressPostEndpoint("https://example.com/", "")).toBe("https://example.com/wp-json/wp/v2/posts");
    expect(canUpdateWordPressDraft("draft")).toBe(true);
    expect(canUpdateWordPressDraft("future")).toBe(true);
    expect(canUpdateWordPressDraft("publish")).toBe(false);
  });

  it("uses WordPress native future status only for a date beyond the 72-hour holdback", () => {
    const scheduledFor = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString();
    const draft = prepareDraftBody({
      websiteId: "website-1",
      articleKey: "audit-1:scheduled",
      title: "A scheduled article",
      contentHtml: `<p>${"Useful scheduled article content. ".repeat(8)}</p>`,
      scheduledFor,
    });
    expect(wordpressDraftPayload(draft)).toMatchObject({ status: "future", date_gmt: scheduledFor.replace(/\.\d{3}Z$/, "") });
    expect(() => prepareDraftBody({ ...draft, scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() })).toThrow(/72 hours/i);
  });

  it("sets the dedicated featured image and anchors captioned inline graphics to their sections", () => {
    const draft = prepareDraftBody({
      websiteId: "website-1",
      articleKey: "audit-1:keyword",
      title: "A useful article",
      contentHtml: `<!-- wp:heading {"level":2} --><h2>First section</h2><!-- /wp:heading --><p>${"Opening content. ".repeat(8)}</p><!-- wp:heading {"level":2} --><h2>Second section</h2><!-- /wp:heading --><p>Two</p>`,
      excerpt: "A concise summary.",
    });
    const media = [
      { id: 20, sourceUrl: "https://example.com/uploads/featured.webp", alt: "Featured graphic", role: "featured" as const, caption: "", placementAfterHeading: "" },
      { id: 21, sourceUrl: "https://example.com/uploads/second.webp", alt: "Second graphic", role: "inline" as const, caption: "Source: Destiny research", placementAfterHeading: "Second section" },
    ];
    const content = insertWordPressFigures(draft.contentHtml, media);
    expect(content).not.toContain("featured.webp");
    expect(content).toContain('<!-- wp:image {"id":21,"sizeSlug":"large"} -->');
    expect(content).toContain('<figcaption class="wp-element-caption">Source: Destiny research</figcaption>');
    expect(content.indexOf("second.webp")).toBeGreaterThan(content.indexOf("Second section"));
    expect(content).toContain('</h2><!-- /wp:heading --><!-- wp:image');
    expect(content).not.toMatch(/<!-- wp:heading[\s\S]*?<!-- wp:image[\s\S]*?<!-- \/wp:heading -->/);
    expect(wordpressDraftPayload(draft, media)).toMatchObject({ status: "draft", featured_media: 20, content });
  });

  it("falls back to the next unused H2 when an inline image has no matching anchor", () => {
    const draft = prepareDraftBody({
      websiteId: "website-1",
      articleKey: "audit-1:keyword",
      title: "A useful article",
      contentHtml: `<p>${"Opening content. ".repeat(8)}</p><h2>First section</h2><p>One</p>`,
    });
    const content = insertWordPressFigures(draft.contentHtml, [{
      id: 22,
      sourceUrl: "https://example.com/uploads/inline.webp",
      alt: "Inline graphic",
      role: "inline",
      caption: "Destiny original",
      placementAfterHeading: "Missing section",
    }]);
    expect(content.indexOf("inline.webp")).toBeGreaterThan(content.indexOf("First section"));
  });

  it("verifies WordPress saved the featured image and every inline attachment", () => {
    const media = [
      { id: 20, sourceUrl: "https://example.com/featured.webp", alt: "Featured", role: "featured" as const, caption: "", placementAfterHeading: "" },
      { id: 21, sourceUrl: "https://example.com/inline.webp", alt: "Useful diagram", role: "inline" as const, caption: "Source", placementAfterHeading: "First section" },
    ];
    expect(verifyDeliveredDraftMedia({
      featuredMedia: 20,
      contentHtml: '<figure class="destiny-article-figure"><img class="wp-image-21" src="https://example.com/inline.webp" alt="Useful diagram"></figure>',
    }, media)).toEqual({ verified: true, reason: "" });
    expect(verifyDeliveredDraftMedia({ featuredMedia: 0, contentHtml: "" }, media)).toMatchObject({ verified: false });
    expect(verifyDeliveredDraftMedia({
      featuredMedia: 20,
      contentHtml: '<!-- wp:heading {"level":2} --><h2>First section</h2><!-- wp:image {"id":21} --><figure><img class="wp-image-21" alt="Useful diagram"></figure><!-- /wp:image --><!-- /wp:heading -->',
    }, media)).toMatchObject({ verified: false, reason: expect.stringMatching(/inside a heading block/i) });
    expect(verifyDeliveredDraftMedia({
      featuredMedia: 20,
      contentHtml: '<!-- wp:heading {"level":2} --><h2>First section</h2><!-- /wp:heading --><!-- wp:image {"id":21} --><figure><img class="wp-image-21" alt="Useful diagram"></figure><!-- /wp:image -->',
    }, media)).toEqual({ verified: true, reason: "" });
  });

  it("creates a stable, short fingerprint from the article text", () => {
    expect(contentFingerprint("A Useful Article", "<p>Practical <strong>opening</strong> paragraph.</p>"))
      .toBe("a useful article practical opening paragraph");
  });

  it("rejects an incomplete draft", () => {
    expect(() => prepareDraftBody({ websiteId: "website-1", articleKey: "article", title: "Title", contentHtml: "short" })).toThrow();
  });
});
