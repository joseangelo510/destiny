import { describe, expect, it } from "vitest";
import { articleCanBeApproved, buildArticleDraft, buildWordDocument, fitMetaDescription, mergePersistedArticleDrafts, normalizeArticleBody, renderArticleMarkdownToHtml } from "./article-draft";

describe("article review workspace", () => {
  it("creates an editable, business-specific article and Word-compatible document", async () => {
    const draft = buildArticleDraft({
      keyword: "saas content marketing agency",
      businessName: "Jose Angelo Studios",
      problemSolved: "Founders need qualified traffic without generic content.",
      idealCustomer: "Founder-led service businesses",
      differentiation: "Fifteen years of practical SEO experience",
    });
    expect(draft.title).toContain("SaaS Content Marketing Agency");
    expect(draft.body).toContain("Jose Angelo Studios");
    expect(draft.body).toContain("Founder-led service businesses");
    expect(draft.generationStatus).toBe("starter");
    expect(draft.metaDescriptions).toHaveLength(2);
    expect(draft.metaDescriptions.every((description) => description.length <= 150)).toBe(true);
    expect(draft.body).not.toContain("experience.. That matters");
    expect(draft.preferences.format).toBe("seo_article");
    expect(await articleCanBeApproved(draft)).toBe(false);
    const document = buildWordDocument(draft);
    expect(document).toContain("application-ready Destiny article");
    expect(document).toContain("Meta description 2");
    expect(fitMetaDescription("A very long saved description ".repeat(12)).length).toBeLessThanOrEqual(150);
    expect(normalizeArticleBody("Local experience.. That matters because it is specific.")).toBe("Local experience. That matters because it is specific.");
  });

  it("renders generated Markdown as clean Word formatting instead of visible syntax", () => {
    const html = renderArticleMarkdownToHtml(`# A useful guide

This is **important**, *helpful*, and links to [the source](https://example.com/report).

## What to do

- First useful step
- Second **important** step

1. Review the evidence
2. Publish the update

### Final note

Copy this into your CMS editor.`);

    expect(html).toContain("<h1>A useful guide</h1>");
    expect(html).toContain("<h2>What to do</h2>");
    expect(html).toContain("<h3>Final note</h3>");
    expect(html).toContain("<strong>important</strong>");
    expect(html).toContain("<em>helpful</em>");
    expect(html).toContain('<a href="https://example.com/report">the source</a>');
    expect(html).toContain("<ul><li>First useful step</li><li>Second <strong>important</strong> step</li></ul>");
    expect(html).toContain("<ol><li>Review the evidence</li><li>Publish the update</li></ol>");
    expect(html).not.toMatch(/(^|>)#{1,6}\s/m);
    expect(html).not.toContain("**");
    expect(html).not.toContain("[the source](https://example.com/report)");
  });

  it("does not allow Markdown links to inject WordPress HTML attributes", () => {
    const html = renderArticleMarkdownToHtml('[unsafe](https://example.com/"onmouseover="alert(1))');

    expect(html).toContain("&quot;");
    expect(html).not.toContain('onmouseover="alert(1)"');
  });

  it("restores a generated server draft over its starter article on page load", () => {
    const starter = buildArticleDraft({
      keyword: "content marketing service",
      businessName: "Jose Angelo Studios",
      problemSolved: "Founders need qualified traffic.",
      idealCustomer: "Small-business founders",
      differentiation: "Hands-on strategy",
    });
    const generated = {
      ...starter,
      title: "How to Choose a Content Marketing Service",
      body: "# Generated article\n\nA complete, persisted article.",
      generationStatus: "generated" as const,
      generatedBy: "claude-opus-4-8",
    };

    expect(mergePersistedArticleDrafts([starter], [generated])).toEqual([generated]);
  });
});
