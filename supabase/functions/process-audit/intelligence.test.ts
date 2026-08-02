import { describe, expect, it } from "vitest";
import { buildKeywordFacts as buildBrowserKeywordFacts, extractSiteVocabulary as extractBrowserVocabulary } from "../../../src/lib/seo/site-intelligence";
import { buildKeywordFacts, extractSiteVocabulary, parseContentPage, selectImportantPageLinks } from "./intelligence";

describe("audit-worker intelligence parity", () => {
  const pages = [
    { url: "https://example.com/", role: "homepage" as const, title: "College admissions", text: "College admissions counseling for high school students." },
    { url: "https://example.com/services", role: "product" as const, title: "Admissions services", text: "Essay coaching and college application strategy." },
  ];

  it("keeps worker vocabulary and keyword facts identical to the browser helpers", () => {
    const browser = extractBrowserVocabulary(pages, "College counseling for families");
    const worker = extractSiteVocabulary(pages, "College counseling for families");
    expect(worker).toEqual(browser);
    expect(buildKeywordFacts("college admissions consultants", worker, 2)).toEqual(buildBrowserKeywordFacts("college admissions consultants", browser, 2));
  });

  it("parses content evidence and selects no more than five strategic internal pages", () => {
    const parsed = parseContentPage({
      url: "https://example.com/",
      title: "Example",
      page_as_markdown: "# College admissions\nTrusted counseling.",
      links: [{ url: "https://example.com/services" }, { url: "https://example.com/about" }, { url: "https://other.example/contact" }],
    }, "homepage");
    expect(parsed.text).toContain("College admissions");
    expect(selectImportantPageLinks(parsed.url, parsed.links)).toEqual([
      { url: "https://example.com/", role: "homepage" },
      { url: "https://example.com/services", role: "product" },
      { url: "https://example.com/about", role: "about" },
    ]);
  });
});
