import { describe, expect, it } from "vitest";
import { articleCanBeApproved, buildArticleDraft, buildWordDocument, fitMetaDescription, mergePersistedArticleDrafts, normalizeArticleBody } from "./article-draft";

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
    expect(draft.metaDescriptions).toHaveLength(1);
    expect(draft.metaDescriptions.every((description) => description.length <= 150)).toBe(true);
    expect(draft.body).not.toContain("experience.. That matters");
    expect(draft.preferences.format).toBe("seo_article");
    expect(await articleCanBeApproved(draft)).toBe(false);
    const document = buildWordDocument(draft);
    expect(document).toContain("application-ready Destiny article");
    expect(document).toContain("Meta description 1");
    expect(document).not.toContain("Meta description 2");
    expect(fitMetaDescription("A very long saved description ".repeat(12)).length).toBeLessThanOrEqual(150);
    expect(normalizeArticleBody("Local experience.. That matters because it is specific.")).toBe("Local experience. That matters because it is specific.");
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
      body: `# Generated article\n\n${"A complete, persisted, research-backed paragraph with enough substance to satisfy the editorial depth requirement. ".repeat(140)}`,
      generationStatus: "generated" as const,
      generatedBy: "claude-opus-4-8",
      qualityIssues: [] as typeof starter.qualityIssues,
    };

    expect(mergePersistedArticleDrafts([starter], [generated])).toEqual([generated]);
  });

  it("keeps a generated article with a QA warning visible without implicit approval", () => {
    const starter = buildArticleDraft({
      keyword: "content marketing service",
      businessName: "Jose Angelo Studios",
      problemSolved: "Founders need qualified traffic.",
      idealCustomer: "Small-business founders",
      differentiation: "Hands-on strategy",
    });
    const longBody = `# Generated article\n\n${"Substantial paragraph content that comfortably clears the word-count requirement for a full article. ".repeat(140)}`;
    const warned = {
      ...starter,
      title: "How to Choose a Content Marketing Service",
      body: longBody,
      sources: [{ title: "Industry study", url: "https://example.com/study" }],
      generationStatus: "generated" as const,
      generatedBy: "claude-opus-4-8",
      qualityIssues: [{ code: "heading_h2_count", detail: "Add more H2 sections." }] as typeof starter.qualityIssues,
    };

    const [merged] = mergePersistedArticleDrafts([starter], [warned]);
    expect(merged.generationStatus).toBe("generated");
    expect(merged.body).toBe(normalizeArticleBody(longBody));
    expect(merged.title).toBe(warned.title);
    expect(merged.sources).toEqual(warned.sources);
    expect(merged.qualityIssues).toEqual(warned.qualityIssues);
    expect("approved" in merged && (merged as { approved?: boolean }).approved === true).toBe(false);
  });

  it("keeps unqualified article content but demotes it to needs_generation", () => {
    const starter = buildArticleDraft({
      keyword: "content marketing service",
      businessName: "Jose Angelo Studios",
      problemSolved: "Founders need qualified traffic.",
      idealCustomer: "Small-business founders",
      differentiation: "Hands-on strategy",
    });
    const longBody = `# Generated article\n\n${"Substantial paragraph content that comfortably clears the word-count requirement for a full article. ".repeat(140)}`;
    const noProvenance = { ...starter, title: "Saved article", body: longBody, generationStatus: "generated" as const, qualityIssues: [] as typeof starter.qualityIssues };
    const incomplete = { ...noProvenance, generatedBy: "claude-opus-4-8", qualityIssues: [{ code: "incomplete_output", detail: "cut off" }] as typeof starter.qualityIssues };
    const tooShort = { ...noProvenance, generatedBy: "claude-opus-4-8", body: "# Generated article\n\nToo short." };

    for (const unsafe of [noProvenance, incomplete, tooShort]) {
      const [merged] = mergePersistedArticleDrafts([starter], [unsafe]);
      expect(merged.generationStatus).toBe("needs_generation");
      expect(merged.title).toBe(unsafe.title);
      expect(merged.body).toBe(normalizeArticleBody(unsafe.body));
    }
  });
});
