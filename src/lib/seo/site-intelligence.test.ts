import { describe, expect, it } from "vitest";
import {
  buildKeywordFacts,
  extractSiteVocabulary,
  selectImportantPageLinks,
} from "./site-intelligence";

describe("site intelligence", () => {
  it("selects five useful same-domain pages with explicit roles", () => {
    expect(selectImportantPageLinks("https://example.com/", [
      "https://example.com/contact",
      "https://example.com/blog/news",
      "https://example.com/about-us",
      "https://example.com/how-it-works",
      "https://example.com/solutions/college-admissions",
      "https://outside.example/product",
    ])).toEqual([
      { url: "https://example.com/", role: "homepage" },
      { url: "https://example.com/solutions/college-admissions", role: "product" },
      { url: "https://example.com/how-it-works", role: "how_it_works" },
      { url: "https://example.com/about-us", role: "about" },
      { url: "https://example.com/contact", role: "contact" },
    ]);
  });

  it("does not fabricate missing pages or fill evidence with arbitrary links", () => {
    expect(selectImportantPageLinks("https://example.com/", [])).toEqual([
      { url: "https://example.com/", role: "homepage" },
    ]);
    expect(selectImportantPageLinks("https://example.com/", [
      "https://example.com/uncategorized/random-post",
      "https://example.com/blog/admissions-news",
      "https://example.com/services/college-admissions",
    ], 8)).toEqual([
      { url: "https://example.com/", role: "homepage" },
      { url: "https://example.com/services/college-admissions", role: "product" },
    ]);
  });

  it("extracts an inspectable weighted vocabulary from multiple pages", () => {
    const vocabulary = extractSiteVocabulary([
      { url: "https://example.com/", role: "homepage", text: "College admissions counseling and application strategy for high school students and families." },
      { url: "https://example.com/services", role: "product", text: "Personal college counseling, essay coaching, and admissions strategy for competitive universities." },
    ], "Admissions consulting for high school students");

    expect(vocabulary.slice(0, 12).map((term) => term.term)).toContain("college admissions");
    expect(vocabulary.some((term) => term.sourcePages.includes("product"))).toBe(true);
    expect(vocabulary.some((term) => term.term === "and")).toBe(false);
  });

  it("turns fuzzy text evidence into deterministic facts for LOGOS", () => {
    const facts = buildKeywordFacts("best college admissions consultants", [
      { term: "college admissions", normalized: "college admission", weight: 10, sourcePages: ["homepage", "product"], evidence: "College admissions counseling" },
      { term: "admissions consulting", normalized: "admission consulting", weight: 7, sourcePages: ["product"], evidence: "Admissions consulting" },
    ], 2);
    expect(facts.coreMatches).toBeGreaterThanOrEqual(1);
    expect(facts.competitorRankers).toBe(2);
    expect(facts.matchedTerms).toContain("college admissions");
  });

  it("does not treat two generic one-word overlaps as strong site evidence", () => {
    const facts = buildKeywordFacts("books about marketing and sales", [
      { term: "marketing", normalized: "marketing", weight: 12, sourcePages: ["homepage"], evidence: "Marketing" },
      { term: "sales", normalized: "sale", weight: 12, sourcePages: ["product"], evidence: "Sales" },
    ], 2);
    expect(facts.supportMatches).toBe(2);
    expect(facts.coreMatches).toBe(0);
  });
});
