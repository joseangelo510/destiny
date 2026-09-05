import { describe, expect, it } from "vitest";
import { prepareKeywordCandidates } from "./prepare-keyword-candidates";

describe("mixed legacy and researched strategy", () => {
  it("keeps an independently researched recommendation when an old audit lacks scoring metadata", () => {
    const researched = { keyword: "seo website migration checklist", priorityScore: 75, priorityReason: "Matched to the saved SEO audit theme", themeId: "seo-audits", themeLabel: "SEO audits", searchVolume: 170 };
    const result = prepareKeywordCandidates([{ keyword: "seo consulting services", intent: "commercial", searchVolume: 900 }, researched], { productsServices: "SEO consulting services" });
    expect(result).toContainEqual(researched);
    expect(result.some((item) => item.keyword === "seo consulting services")).toBe(true);
  });
});
