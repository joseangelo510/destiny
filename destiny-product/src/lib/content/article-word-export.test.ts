import { describe, expect, it } from "vitest";
import mammoth from "mammoth";
import { buildArticleDraft, type ArticleDraft } from "./article-draft";
import { createArticleWordDocument, InvalidArticleWordGraphicError } from "./article-word-export";

describe("article Word export with reviewed graphics", () => {
  it("roundtrips both article graphics as embedded images alongside editable text", async () => {
    const draft = buildArticleDraft({
      keyword: "employment background check guide",
      businessName: "ClearCheck",
      problemSolved: "Employers need reliable background checks.",
      idealCustomer: "Hiring teams",
      differentiation: "Clear guidance",
    });
    draft.infographics = ["Timeline", "Checklist"].map((title, index) => ({
      id: `graphic-${index + 1}`,
      template: index === 0 ? "timeline" as const : "checklist" as const,
      title,
      insight: `Reviewed insight ${index + 1}`,
      items: ["Step one", "Step two"],
      sourceLabel: "ClearCheck research",
      altText: `${title} for hiring teams`,
      caption: `${title} caption`,
    }));

    const docx = await createArticleWordDocument(draft);
    const converted = await mammoth.convertToHtml({ buffer: docx });
    expect(converted.value).toContain("ClearCheck");
    expect(converted.value).toContain("Timeline caption");
    expect(converted.value).toContain("Checklist caption");
    expect(converted.value.match(/<img\b/g)).toHaveLength(2);
    expect(converted.value.match(/data:image\/png;base64,/g)).toHaveLength(2);
  });

  it("rejects malformed graphics instead of exporting an incomplete document", async () => {
    const draft = buildArticleDraft({
      keyword: "employment background check guide",
      businessName: "ClearCheck",
      problemSolved: "Employers need reliable background checks.",
      idealCustomer: "Hiring teams",
      differentiation: "Clear guidance",
    });
    draft.infographics = [{ title: "Missing items" } as ArticleDraft["infographics"][number]];
    await expect(createArticleWordDocument(draft)).rejects.toBeInstanceOf(InvalidArticleWordGraphicError);
  });
});
