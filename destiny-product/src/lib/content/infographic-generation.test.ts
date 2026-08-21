import { describe, expect, it } from "vitest";
import {
  INFOGRAPHIC_HEIGHT,
  INFOGRAPHIC_WIDTH,
  buildInfographicResearchPrompt,
  buildInfographicArtPrompt,
  buildOpenAiInfographicResearchRequest,
  infographicPlanIssues,
  parseOpenAiInfographicResearch,
  renderInfographicOverlaySvg,
  type InfographicPlan,
} from "./infographic-generation";

const sources = Array.from({ length: 4 }, (_, index) => ({
  id: `source-${index + 1}`,
  title: `Primary research ${index + 1}`,
  url: `https://research.example/report-${index + 1}`,
  publisher: "Research Example",
  publishedAt: "2026-04-15",
  credibility: "Primary research",
}));

const sections = Array.from({ length: 4 }, (_, index) => ({
  id: `section-${index + 1}`,
  eyebrow: `Signal ${index + 1}`,
  title: `What the evidence shows ${index + 1}`,
  takeaway: "A plain-language explanation of why this finding matters to the intended reader.",
  dataPoints: [{
    value: `${24 + index}%`,
    label: `Measured outcome ${index + 1}`,
    context: "The reported change in the cited research period.",
    sourceIds: [`source-${index + 1}`],
  }],
}));

const articleBody = Array.from({ length: 640 }, (_, index) => index % 80 === 0 ? "\n\n## Evidence explained\n\n" : "useful ").join("");

const validPlan: InfographicPlan = {
  title: "Four signals shaping a smarter decision",
  subtitle: "A current, evidence-backed visual guide",
  audience: "Small-business owners",
  visualDirection: "Warm editorial shapes with a clear upward path and generous whitespace.",
  altText: "A four-part infographic showing four measured signals and their cited sources.",
  sections,
  sources,
  article: {
    title: "Four Signals Shaping a Smarter Decision",
    metaTitle: "Four Signals Shaping a Smarter Decision",
    metaDescription: "Explore four current, cited signals and what each one means for your next decision.",
    markdown: `# Four Signals Shaping a Smarter Decision\n\n${articleBody}`,
  },
  repurposeCards: sections.map((section, index) => ({
    id: `card-${index + 1}`,
    title: section.title,
    copy: `Use the ${24 + index}% finding to explain one focused lesson without stripping away its context.`,
    recommendedChannel: index % 2 ? "LinkedIn" : "Instagram",
    sourceIds: [`source-${index + 1}`],
  })),
};

describe("Destiny infographic generation", () => {
  it("asks for current, primary evidence and exactly four reusable stories", () => {
    const prompt = buildInfographicResearchPrompt({
      keyword: "employee background check trends",
      businessName: "ClearCheck",
      productsServices: "Background screening software",
      problemSolved: "Helps employers screen candidates clearly",
      idealCustomer: "HR leaders",
      differentiation: "Plain-language compliance guidance",
      style: "editorial",
      specialInstructions: "Keep it practical.",
      now: "2026-08-21",
    });
    expect(prompt).toContain("exactly four story panels");
    expect(prompt).toContain("Prefer evidence published within the last 24 months");
    expect(prompt).toContain("500–1,000 words");
    expect(prompt).toContain("four to eight distinct credible sources");
    expect(prompt).toContain("Never invent a statistic");
    expect(prompt).toContain("Four repurpose cards");
  });

  it("builds a bounded web-research request with structured output", () => {
    const request = buildOpenAiInfographicResearchRequest("Research this", "gpt-5.6-sol");
    expect(request.model).toBe("gpt-5.6-sol");
    expect(request.store).toBe(false);
    expect(request.tools).toContainEqual(expect.objectContaining({ type: "web_search", search_context_size: "high" }));
    expect(request.include).toContain("web_search_call.action.sources");
    expect(request.text.format).toEqual(expect.objectContaining({ type: "json_schema", strict: true }));
  });

  it("rejects thin, uncited, or inaccessible plans", () => {
    expect(infographicPlanIssues({ ...validPlan, sections: validPlan.sections.slice(0, 3) }, new Set(sources.map((source) => source.url)))).toContain("Use exactly four story panels so the infographic can become four standalone pieces.");
    expect(infographicPlanIssues({ ...validPlan, sources: sources.slice(0, 3) }, new Set(sources.map((source) => source.url)))).toContain("Use at least four distinct credible sources.");
    expect(infographicPlanIssues(validPlan, new Set([sources[0].url]))).toContain("Every cited source must come from OpenAI's retrieved web evidence.");
  });

  it("accepts only sources verified in the web-search response", () => {
    const response = {
      output: [
        { type: "web_search_call", action: { sources: sources.map((source) => ({ type: "url", url: source.url, title: source.title })) } },
        { type: "message", content: [{ type: "output_text", text: JSON.stringify(validPlan), annotations: sources.map((source) => ({ type: "url_citation", url: source.url, title: source.title })) }] },
      ],
    };
    const result = parseOpenAiInfographicResearch(response);
    expect(result.plan.sections).toHaveLength(4);
    expect(result.retrievedUrls).toHaveLength(4);
  });

  it("accepts harmless canonical and tracking differences without accepting another source", () => {
    const tracked = new Set(sources.map((source, index) => index === 0 ? `${source.url}/?utm_source=openai` : source.url));
    expect(infographicPlanIssues(validPlan, tracked)).not.toContain("Every cited source must come from OpenAI's retrieved web evidence.");
    const encoded = { ...validPlan, sources: [{ ...sources[0], url: "https://research.example/Business+Wire/report" }, ...sources.slice(1)] };
    const encodedRetrieved = new Set(["https://research.example/Business%2BWire/report", ...sources.slice(1).map((source) => source.url)]);
    expect(infographicPlanIssues(encoded, encodedRetrieved)).not.toContain("Every cited source must come from OpenAI's retrieved web evidence.");
    const providerQuery = new Set(sources.map((source, index) => index === 0 ? `${source.url}?output=1&hsCtaTracking=provider-generated` : source.url));
    expect(infographicPlanIssues(validPlan, providerQuery)).not.toContain("Every cited source must come from OpenAI's retrieved web evidence.");
    expect(infographicPlanIssues(validPlan, new Set(["https://unrelated.example/report"]))).toContain("Every cited source must come from OpenAI's retrieved web evidence.");
  });

  it("renders accurate text and a visible source ledger over the generated visual layer", () => {
    const svg = renderInfographicOverlaySvg(validPlan);
    expect(svg).toContain(`viewBox="0 0 ${INFOGRAPHIC_WIDTH} ${INFOGRAPHIC_HEIGHT}"`);
    expect(svg).toContain("Four signals shaping a smarter decision");
    expect(svg).toContain("24%");
    expect(svg).toContain("Sources");
    expect(svg).toContain("Research Example");
    expect(svg).toContain("research.example");
    expect(svg).toContain("Data and labels rendered by Destiny");
  });

  it("shrinks long primary statistics so they stay inside their evidence card", () => {
    const longStatistic = {
      ...validPlan,
      sections: validPlan.sections.map((section, index) => index === 0
        ? { ...section, dataPoints: [{ ...section.dataPoints[0], value: "3 checkpoints" }] }
        : section),
    };
    const svg = renderInfographicOverlaySvg(longStatistic);
    expect(svg).toContain('font-size="28" font-weight="800">3 checkpoints</text>');
  });

  it("keeps complete evidence labels visible across up to four readable lines", () => {
    const detailedLabels = {
      ...validPlan,
      sections: validPlan.sections.map((section, index) => index === 0
        ? {
            ...section,
            dataPoints: [
              { ...section.dataPoints[0], label: "Name AI-generated applications as the single biggest employment-screening risk over the next five years" },
              { ...section.dataPoints[0], value: "#1", label: "Accuracy and quality remained the leading provider-selection priority" },
            ],
          }
        : section),
    };
    const svg = renderInfographicOverlaySvg(detailedLabels);
    expect(svg).toContain("employment-screening risk over</text>");
    expect(svg).toContain("the next five years</text>");
    expect(svg).not.toContain("five…");
    expect(svg).toContain(">priority</text>");
  });

  it("adds an ellipsis when a source publisher is too long for the ledger column", () => {
    const longPublisher = {
      ...validPlan,
      sources: validPlan.sources.map((source, index) => index === 0
        ? { ...source, publisher: "Federal Trade Commission and Equal Employment Opportunity Commission" }
        : source),
    };
    const svg = renderInfographicOverlaySvg(longPublisher);
    expect(svg).toContain("source-1 · Federal Trade Commission and…");
  });

  it("asks OpenAI for decoration only so exact facts remain deterministic", () => {
    const prompt = buildInfographicArtPrompt(validPlan, "editorial");
    expect(prompt).toContain("four visually distinct zones");
    expect(prompt).toContain("Include NO words, letters, numbers, statistics");
    expect(prompt).toContain("The exact overlay will be added later by software");
  });

  it("rejects an unsafe source link even when a client resubmits a plan", () => {
    const unsafe = { ...validPlan, sources: [{ ...sources[0], url: "javascript:alert(1)" }, ...sources.slice(1)] };
    expect(infographicPlanIssues(unsafe, new Set(unsafe.sources.map((source) => source.url)))).toContain("Every source link must use a secure web address.");
  });
});
