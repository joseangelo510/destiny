import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { KeywordResearchWorkspace, PerformanceChart } from "./keyword-research-workspace";

describe("KeywordResearchWorkspace", () => {
  it("starts with a domain-or-keyword research choice and live-data explanation", () => {
    const html = renderToStaticMarkup(<KeywordResearchWorkspace initialQuery="empowerly.com" />);
    expect(html).toContain("Destiny Research Lab");
    expect(html).toContain("Domain");
    expect(html).toContain("Keyword");
    expect(html).toContain("empowerly.com");
    expect(html).toContain("Run your first research report");
  });

  it("renders a truthful 90-day organic performance graph with metric controls", () => {
    const html = renderToStaticMarkup(<PerformanceChart metric="traffic" onMetricChange={() => undefined} points={[
      { date: "2026-06-01", traffic: 91, keywords: 49, top3: 5, top10: 14 },
      { date: "2026-07-01", traffic: 118, keywords: 61, top3: 7, top10: 19 },
      { date: "2026-08-01", traffic: 146, keywords: 72, top3: 10, top10: 25 },
    ]} />);
    expect(html).toContain("Last 90 days");
    expect(html).toContain("Organic traffic");
    expect(html).toContain("Ranking keywords");
    expect(html).toContain("60%");
    expect(html).toContain("Provider estimates—not Google Analytics sessions");
    expect(html).toContain("Estimated organic traffic over the last 90 days");
  });
});
