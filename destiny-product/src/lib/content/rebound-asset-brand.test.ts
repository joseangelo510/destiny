import { describe, expect, it } from "vitest";
import { renderFeaturedImageSvg } from "./article-generation";

describe("Rebound generated asset identity", () => {
  it("labels a new featured asset with the visible product name and preserves escaped customer text", () => {
    const svg = renderFeaturedImageSvg("Growth & <trust>", "customer's guide");
    expect(svg).toContain("REBOUND SEO GUIDE");
    expect(svg).not.toContain("DESTINY GUIDE");
    expect(svg).toContain("Growth &amp; &lt;trust&gt;");
    expect(svg).toContain("customer&apos;s guide");
    expect(svg).toContain('viewBox="0 0 1200 630"');
  });
});
