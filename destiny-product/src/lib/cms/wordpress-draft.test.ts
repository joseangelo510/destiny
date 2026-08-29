import { describe, expect, it } from "vitest";
import { prepareWordPressDraft } from "./wordpress-draft";

const titleCandidates = ["numbered", "how_to", "second_person", "question", "descriptive", "benefit"].map((format, index) => ({ format, headline: `Candidate ${index + 1}`, metaTitle: `Junk Removal Services Candidate ${index + 1} Guide`, score: 90 - index, rationale: "Accurate." }));

const validDraft = {
  websiteId: "website-1",
  auditId: "audit-1",
  keyword: "junk removal services",
  title: "Junk Removal Services: A Practical Guide",
  metaTitle: "Junk Removal Services: A Practical Guide",
  titleCandidates,
  body: `# Junk Removal Services: A Practical Guide\n\n${"A useful paragraph about choosing a reliable local junk removal service. ".repeat(4)}\n\n## What to compare\n\n- Transparent pricing\n- Local experience`,
  metaDescription: "Compare local junk removal services and choose the right provider.",
  infographics: [{
    id: "comparison-guide",
    template: "comparison",
    title: "Compare Junk Removal Services",
    insight: "Use the same five checks for every provider.",
    items: ["Pricing", "Licensing", "Recycling"],
    sourceLabel: "Source: Rebound SEO article research",
    altText: "Checklist for comparing junk removal services",
  }],
  approved: true,
  generationStatus: "generated",
};

describe("WordPress draft preparation", () => {
  it("converts an approved article into the server-only transfer contract", () => {
    expect(prepareWordPressDraft(validDraft)).toEqual(expect.objectContaining({
      websiteId: "website-1",
      articleKey: "audit-1:junk removal services",
      title: validDraft.title,
      metaTitle: validDraft.metaTitle,
      renderingVersion: "wordpress-blocks-v2",
      excerpt: validDraft.metaDescription,
      contentHtml: expect.stringContaining("<p>A useful paragraph"),
    }));
    expect(prepareWordPressDraft(validDraft).contentHtml).not.toContain("<h1>");
    expect(prepareWordPressDraft(validDraft).contentHtml).toContain("<ul><li>Transparent pricing</li>");
    expect(prepareWordPressDraft(validDraft).contentHtml).toContain("destiny-article");
    expect(prepareWordPressDraft(validDraft).contentHtml).toContain('<!-- wp:heading {"level":2} -->');
    expect(prepareWordPressDraft(validDraft).contentHtml).toContain('<!-- wp:list -->');
    expect(prepareWordPressDraft(validDraft).featuredGraphic).toEqual(expect.objectContaining({
      name: "junk-removal-services-a-practical-guide-featured",
      role: "featured",
      alt: "Junk Removal Services: A Practical Guide featured image",
      svg: expect.stringContaining('viewBox="0 0 1200 630"'),
    }));
    expect(prepareWordPressDraft(validDraft).graphics).toEqual([
      expect.objectContaining({
        name: "comparison-guide",
        role: "inline",
        alt: "Checklist for comparing junk removal services",
        caption: "Source: Rebound SEO article research",
        placementAfterHeading: "What to compare",
        svg: expect.stringContaining("<svg"),
      }),
    ]);
  });

  it.each([
    { ...validDraft, approved: false },
    { ...validDraft, generationStatus: "needs_generation" },
    { ...validDraft, websiteId: "" },
    { ...validDraft, body: "Too short" },
  ])("rejects an incomplete or unapproved transfer", (input) => {
    expect(() => prepareWordPressDraft(input)).toThrow();
  });

  it("blocks a previously approved legacy draft without researched title candidates", () => {
    expect(() => prepareWordPressDraft({ ...validDraft, titleCandidates: [] })).toThrow(/headline and SEO\/meta title/i);
  });

  it("preserves an approved future publication date", () => {
    const scheduledFor = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString();
    expect(prepareWordPressDraft({ ...validDraft, scheduledFor })).toMatchObject({ scheduledFor });
    expect(() => prepareWordPressDraft({ ...validDraft, scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() })).toThrow(/72 hours/i);
  });
});

describe("WordPress draft HTML safety", () => {
  it("does not allow attribute injection through hostile Markdown links", () => {
    const hostile = prepareWordPressDraft({
      ...validDraft,
      body: `# Junk Removal Services: A Practical Guide\n\n${"Padding sentence for the minimum body length requirement. ".repeat(4)}[click](https://example.com/a"onmouseover="alert(1)) and [ok](https://example.com/safe)`,
    });
    expect(hostile.contentHtml).not.toContain('onmouseover="alert');
    expect(hostile.contentHtml).toContain('<a href="https://example.com/safe">ok</a>');
    // Every anchor must be exactly href + text: no extra attributes can be injected.
    for (const anchor of hostile.contentHtml.match(/<a [^>]*>/g) ?? []) {
      expect(anchor).toMatch(/^<a href="[^"]*">$/);
    }
  });

  it("turns named editorial asides into explicit callouts instead of pseudo-headings", () => {
    const prepared = prepareWordPressDraft({
      ...validDraft,
      body: `# Junk Removal Services: A Practical Guide\n\n${"Opening context for the reader and the decision they need to make. ".repeat(4)}\n\n## What to compare\n\n**Practical tip:** Ask for the written price before pickup.`,
    });
    expect(prepared.contentHtml).toContain("destiny-callout");
    expect(prepared.contentHtml).toContain("Practical tip:");
  });

  it("renders nested italic emphasis inside bold text without literal Markdown markers", () => {
    const prepared = prepareWordPressDraft({
      ...validDraft,
      body: `# Junk Removal Services: A Practical Guide\n\n${"Opening context for the reader and the decision they need to make. ".repeat(4)}\n\n**Choose *when* and *how* to act.**`,
    });
    expect(prepared.contentHtml).toContain("<strong>Choose <em>when</em> and <em>how</em> to act.</strong>");
    expect(prepared.contentHtml).not.toContain("**Choose");
  });
});
