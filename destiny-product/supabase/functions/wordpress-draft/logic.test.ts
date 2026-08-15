import { describe, expect, it } from "vitest";
import { prepareDraftBody, wordpressDraftPayload, wordpressEditUrl } from "./logic";

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

  it("rejects an incomplete draft", () => {
    expect(() => prepareDraftBody({ websiteId: "website-1", articleKey: "article", title: "Title", contentHtml: "short" })).toThrow();
  });
});
