import { describe, expect, it } from "vitest";
import { articleCanBeApproved, buildArticleDraft, buildWordDocument, fitMetaDescription, normalizeArticleBody, savedDraftForKeyword } from "./article-draft";

describe("article review workspace", () => {
  it("creates an editable, business-specific article and Word-compatible document", () => {
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
    expect(articleCanBeApproved(draft)).toBe(false);
    const document = buildWordDocument(draft);
    expect(document).toContain("application-ready Destiny article");
    expect(document).toContain("Meta description 2");
    expect(fitMetaDescription("A very long saved description ".repeat(12)).length).toBeLessThanOrEqual(150);
    expect(normalizeArticleBody("Local experience.. That matters because it is specific.")).toBe("Local experience. That matters because it is specific.");
  });

  it("matches saved browser drafts by keyword so stale excluded keywords cannot override vetted outlines", () => {
    // Real 98junkit regression: drafts persisted from the old unvetted rail
    // included "free junk removal services". After the vetted rail ships,
    // those saved drafts must be discarded, not matched by index.
    const staleSaved = [
      { keyword: "free junk removal services", title: "Free Junk Removal Services", approved: true },
      { keyword: "loadup junk removal", title: "Loadup Junk Removal" },
      { keyword: "commercial junk removal services", title: "My edited commercial title" },
    ];
    expect(savedDraftForKeyword(staleSaved, "commercial junk removal services")).toEqual(staleSaved[2]);
    expect(savedDraftForKeyword(staleSaved, "fremont junk removal")).toBeUndefined();
    expect(savedDraftForKeyword(staleSaved, "free junk removal services")).toEqual(staleSaved[0]);
    expect(savedDraftForKeyword("not-an-array", "fremont junk removal")).toBeUndefined();
    expect(savedDraftForKeyword([null, "string", 4], "fremont junk removal")).toBeUndefined();
  });
});
