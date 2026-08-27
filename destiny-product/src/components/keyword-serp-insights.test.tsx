import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { KeywordSerpDrawer, KeywordSerpInsights, pageTypeLabel } from "./keyword-serp-insights";

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

  it("labels unavailable SERP surfaces as static sample data", () => {
    const html = renderToStaticMarkup(<KeywordSerpInsights
      available={false}
      onResearch={() => undefined}
      onSave={() => undefined}
      questions={[]}
      related={[]}
      sampleKeyword="small business seo consultant"
    />);
    expect(html.match(/Sample data/g)).toHaveLength(3);
    expect(html).toContain("These are example questions to show how this section works. Live questions from Google aren&#x27;t connected yet.");
    expect(html).toContain("Example opportunities shown as a preview. Live suggestions are coming soon.");
    expect(html).toContain("Example first-page results");
    expect(html).toContain("This is a sample of what a first-page competitor check looks like. We can&#x27;t show real Google results for this keyword yet.");
    expect(html).toContain("What should someone compare before choosing small business seo consultant?");
    expect(html).not.toContain("Live first-page evidence");
    expect(html).not.toContain("<button");
  });

  it("reserves live evidence language for a real snapshot", () => {
    const unavailable = renderToStaticMarkup(<KeywordSerpDrawer
      error="The provider is unavailable."
      keyword="small business seo consultant"
      loading={false}
      onClose={() => undefined}
      onRetry={() => undefined}
      onSave={() => undefined}
    />);
    expect(unavailable).toContain("First-page check");
    expect(unavailable).toContain("Google evidence is unavailable.");
    expect(unavailable).not.toContain("Live first-page evidence");

    const live = renderToStaticMarkup(<KeywordSerpDrawer
      keyword="small business seo consultant"
      loading={false}
      onClose={() => undefined}
      onRetry={() => undefined}
      onSave={() => undefined}
      snapshot={{
        keyword: "small business seo consultant",
        location: "United States",
        checkedAt: "2026-08-27T18:00:00.000Z",
        organic: [{ position: 1, domain: "example.com", title: "SEO Consulting", url: "https://example.com/seo", pageType: "service_page" }],
        questions: [],
        related: [],
      }}
    />);
    expect(live).toContain("Live first-page evidence");
    expect(live).not.toContain("Sample data");
  });
});
