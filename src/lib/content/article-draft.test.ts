import { describe, expect, it } from "vitest";
import { buildArticleDraft, buildWordDocument } from "./article-draft";

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
    expect(buildWordDocument(draft)).toContain("application-ready Destiny article");
  });
});
