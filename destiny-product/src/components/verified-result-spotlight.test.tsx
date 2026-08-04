import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { VerifiedResultSpotlight, selectVerifiedResult } from "./verified-result-spotlight";

describe("VerifiedResultSpotlight", () => {
  it("prioritizes connected conversion evidence over weaker signals", () => {
    expect(selectVerifiedResult({ organicKeyEvents: 3, searchClicks: 42, searchImpressions: 900 })).toMatchObject({
      value: "3",
      label: "organic conversions",
      source: "Google Analytics",
    });
  });

  it("does not invent a celebration when connected data has no result", () => {
    expect(selectVerifiedResult({ organicKeyEvents: 0, searchClicks: 0, searchImpressions: 0 })).toBeNull();
  });

  it("clearly separates verified first-party evidence from a projection", () => {
    const result = selectVerifiedResult({ organicKeyEvents: 0, searchClicks: 42, searchImpressions: 900 });
    const html = renderToStaticMarkup(<VerifiedResultSpotlight result={result} />);
    expect(html).toContain("Verified result");
    expect(html).toContain("42");
    expect(html).toContain("Google Search Console");
    expect(html).toContain("connected first-party data—not a projection");
  });
});
