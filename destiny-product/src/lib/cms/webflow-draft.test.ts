import { describe, expect, it } from "vitest";
import { prepareWebflowDraft } from "./webflow-draft";

const titleCandidates = ["numbered", "how_to", "second_person", "question", "descriptive", "benefit"].map((format, index) => ({ format, headline: `Candidate ${index + 1}`, metaTitle: `Junk Removal Services Candidate ${index + 1} Guide`, score: 90 - index, rationale: "Accurate." }));

const validDraft = {
  websiteId: "website-1",
  auditId: "audit-1",
  keyword: "junk removal services",
  title: "Junk Removal Services: A Practical Guide",
  metaTitle: "Junk Removal Services: A Practical Guide",
  titleCandidates,
  body: `# Junk Removal Services: A Practical Guide\n\n${"A useful paragraph about choosing a reliable local junk removal service. ".repeat(4)}\n\n## What to compare\n\n- Transparent pricing\n- Local experience`,
  metaDescription: "Compare local junk removal services with clear pricing signals.",
  infographics: [{
    id: "graphic-1",
    template: "steps",
    title: "How to vet a junk removal service",
    insight: "Three checks catch most problems.",
    items: ["Confirm licensing", "Ask for flat pricing", "Read recent reviews"],
    sourceLabel: "Source: industry survey",
    altText: "Three steps for vetting a junk removal service",
  }],
  approved: true,
  generationStatus: "generated",
};

describe("Webflow draft preparation", () => {
  it("converts an approved article into the server-only transfer contract", () => {
    const prepared = prepareWebflowDraft(validDraft);
    expect(prepared).toEqual(expect.objectContaining({
      websiteId: "website-1",
      articleKey: "audit-1:junk removal services",
      title: validDraft.title,
      metaTitle: validDraft.metaTitle,
      contentHtml: expect.stringContaining("<p>A useful paragraph"),
    }));
    expect(prepared.contentHtml).not.toContain("<h1>");
  });

  it("carries meta description, word count, and rendered graphics with alt text", () => {
    const prepared = prepareWebflowDraft(validDraft);
    expect(prepared.metaDescription).toBe(validDraft.metaDescription);
    expect(prepared.wordCount).toBeGreaterThan(30);
    expect(prepared.graphics).toHaveLength(1);
    expect(prepared.graphics[0].alt).toBe(validDraft.infographics[0].altText);
    expect(prepared.graphics[0].svg.startsWith("<svg")).toBe(true);
    expect(prepared.graphics[0].svg).toContain("How to vet a junk removal service");
  });

  it("tolerates missing optional metadata instead of failing the transfer", () => {
    const prepared = prepareWebflowDraft({ ...validDraft, metaDescription: undefined, infographics: undefined });
    expect(prepared.metaDescription).toBe("");
    expect(prepared.graphics).toEqual([]);
  });

  it("preserves ordered and unordered lists and H2/H3 hierarchy in the transferred body", () => {
    const body = `# Junk Removal Services: A Practical Guide\n\n${"Intro paragraph long enough to satisfy the length gate. ".repeat(3)}\n\n## Steps\n\n1. First step\n2. Second step\n3. Third step\n\n### Details\n\n- Point one\n- Point two`;
    const prepared = prepareWebflowDraft({ ...validDraft, body });
    expect(prepared.contentHtml).toContain("<ol><li>First step</li><li>Second step</li><li>Third step</li></ol>");
    expect(prepared.contentHtml).toContain("<ul><li>Point one</li><li>Point two</li></ul>");
    expect(prepared.contentHtml).toContain("<h2>Steps</h2>");
    expect(prepared.contentHtml).toContain("<h3>Details</h3>");
    expect(prepared.contentHtml).not.toContain("<h1>");
    expect(prepared.contentHtml).not.toContain("1. First step");
  });

  it("shares the WordPress article key so cross-provider transfers stay per-integration idempotent", () => {
    expect(prepareWebflowDraft(validDraft).articleKey.length).toBeLessThanOrEqual(500);
  });

  it.each([
    { ...validDraft, approved: false },
    { ...validDraft, approved: "true" },
    { ...validDraft, generationStatus: "needs_generation" },
    { ...validDraft, generationStatus: "starter" },
    { ...validDraft, websiteId: "" },
    { ...validDraft, keyword: "" },
    { ...validDraft, body: "Too short" },
  ])("rejects an incomplete or unapproved transfer", (input) => {
    expect(() => prepareWebflowDraft(input)).toThrow();
  });

  it("blocks a previously approved legacy draft without researched title candidates", () => {
    expect(() => prepareWebflowDraft({ ...validDraft, titleCandidates: [] })).toThrow(/headline and SEO\/meta title/i);
  });
});
