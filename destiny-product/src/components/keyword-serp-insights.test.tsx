import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { KeywordSerpInsights, pageTypeLabel } from "./keyword-serp-insights";

describe("Keyword SERP insights", () => {
  it("explains truthfully when Google did not show a questions box", () => {
    const html = renderToStaticMarkup(<KeywordSerpInsights checkedAt="2026-08-27T18:00:00.000Z" questions={[]} related={[]} onResearch={() => undefined} onSave={() => undefined} />);
    expect(html).toContain("Questions people ask");
    expect(html).toContain("Google didn’t show a questions box for this search.");
    expect(html).toContain("No additional related searches appeared in this result.");
  });

  it("shows real questions and related opportunities with explicit actions", () => {
    const html = renderToStaticMarkup(<KeywordSerpInsights checkedAt="2026-08-27T18:00:00.000Z" questions={["How much does a YouTube ads agency cost?"]} related={["youtube ads management services"]} onResearch={() => undefined} onSave={() => undefined} />);
    expect(html).toContain("How much does a YouTube ads agency cost?");
    expect(html).toContain("youtube ads management services");
    expect(html).toContain("Save");
    expect(html).toContain("Research this");
    expect(html).toContain("From live Google results");
  });

  it("uses plain-language page-type labels", () => {
    expect(pageTypeLabel("service_page")).toBe("Service page");
    expect(pageTypeLabel("blog_post")).toBe("Blog post");
    expect(pageTypeLabel("tool_or_app")).toBe("Tool or app");
  });
});
