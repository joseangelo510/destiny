import { describe, expect, it } from "vitest";
import { prepareWebflowDraft } from "./webflow-draft";

const validDraft = {
  websiteId: "website-1",
  auditId: "audit-1",
  keyword: "junk removal services",
  title: "Junk Removal Services: A Practical Guide",
  body: `# Junk Removal Services\n\n${"A useful paragraph about choosing a reliable local junk removal service. ".repeat(4)}\n\n## What to compare\n\n- Transparent pricing\n- Local experience`,
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
      contentHtml: expect.stringContaining("<p>A useful paragraph"),
    }));
    expect(prepared.contentHtml).not.toContain("<h1>");
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
});
