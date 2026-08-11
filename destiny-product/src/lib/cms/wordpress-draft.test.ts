import { describe, expect, it } from "vitest";
import { prepareWordPressDraft } from "./wordpress-draft";

const validDraft = {
  websiteId: "website-1",
  auditId: "audit-1",
  keyword: "junk removal services",
  title: "Junk Removal Services: A Practical Guide",
  body: `# Junk Removal Services\n\n${"A useful paragraph about choosing a reliable local junk removal service. ".repeat(4)}\n\n## What to compare\n\n- Transparent pricing\n- Local experience`,
  metaDescription: "Compare local junk removal services and choose the right provider.",
  approved: true,
  generationStatus: "generated",
};

describe("WordPress draft preparation", () => {
  it("converts an approved article into the server-only transfer contract", () => {
    expect(prepareWordPressDraft(validDraft)).toEqual(expect.objectContaining({
      websiteId: "website-1",
      articleKey: "audit-1:junk removal services",
      title: validDraft.title,
      excerpt: validDraft.metaDescription,
      contentHtml: expect.stringContaining("<p>A useful paragraph"),
    }));
    expect(prepareWordPressDraft(validDraft).contentHtml).not.toContain("<h1>");
    expect(prepareWordPressDraft(validDraft).contentHtml).toContain("<ul><li>Transparent pricing</li>");
  });

  it.each([
    { ...validDraft, approved: false },
    { ...validDraft, generationStatus: "needs_generation" },
    { ...validDraft, websiteId: "" },
    { ...validDraft, body: "Too short" },
  ])("rejects an incomplete or unapproved transfer", (input) => {
    expect(() => prepareWordPressDraft(input)).toThrow();
  });
});
