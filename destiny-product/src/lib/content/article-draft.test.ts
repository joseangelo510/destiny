import { describe, expect, it } from "vitest";
import { articleCanBeApproved, buildArticleDraft, buildWordDocument, fitMetaDescription, normalizeArticleBody } from "./article-draft";

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
});
