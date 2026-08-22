import { describe, expect, it } from "vitest";
import { REOPTIMIZATION_CHECKLIST, applyVerifiedInternalLinkPlan, buildAnthropicReoptimizationRequest, buildReoptimizationPrompt, parseReoptimizationStrategy } from "./reoptimization-strategy";

const validPayload = () => ({
  verdict: "light_refresh",
  verdictLabel: "Refresh selectively",
  summary: "The page matches intent and should be preserved.",
  primaryGoal: "Increase qualified clicks.",
  preserve: ["Keep the URL and proven service positioning."],
  keywordFramework: {
    primary: "youtube ads agency",
    secondary: ["youtube advertising agency", "youtube ad agency", "youtube ads services"],
    related: ["youtube ad strategy", "youtube video ad production", "youtube campaign management"],
  },
  headingPlan: {
    summary: "Reduce sibling H2s and make the service journey explicit.",
    recommended: [
      { level: "H1", text: "YouTube Ads Agency", purpose: "State the primary service.", source: "revised" },
      { level: "H2", text: "How the engagement works", purpose: "Explain the buying process.", source: "new" },
    ],
  },
  headingDecisions: [
    { action: "replace", existingLevel: "H1", existingText: "YouTube Advertising Agency", recommendedLevel: "H1", recommendedText: "YouTube Ads Agency for Strategy and Growth", rationale: "Lead with the focus keyword." },
    { action: "replace", existingLevel: "H2", existingText: "Services", recommendedLevel: "H2", recommendedText: "YouTube Ads Services", rationale: "Use a relevant secondary commercial phrase." },
    { action: "add", existingLevel: null, existingText: "", recommendedLevel: "H3", recommendedText: "YouTube Video Ad Production", rationale: "Cover a verified related service." },
  ],
  checklist: REOPTIMIZATION_CHECKLIST.map(({ id }) => ({
    id, status: "pass", priority: "low", finding: "The supplied evidence supports preserving this area.",
    action: "Monitor", current: "Verified current state", recommended: "No replacement proposed.", where: "No CMS edit.",
    evidence: [{ source: "Current page", detail: "The parsed page was reviewed.", url: "https://example.com/page" }],
  })),
  measurementPlan: ["Record the pre-change baseline.", "Review at 14, 30, and 60 days."],
});

describe("re-optimization strategy", () => {
  it("requires all master checklist gates and preserves their canonical order", () => {
    const strategy = parseReoptimizationStrategy(validPayload());
    expect(strategy.checklist.map((item) => item.id)).toEqual(REOPTIMIZATION_CHECKLIST.map((item) => item.id));
  });

  it("rejects evidence-free opportunities instead of allowing fabricated advice", () => {
    const payload = validPayload();
    payload.checklist[2] = { ...payload.checklist[2], status: "opportunity", evidence: [] };
    expect(() => parseReoptimizationStrategy(payload)).toThrow("query-coverage is missing supporting evidence");
  });

  it("instructs the model not to imitate marketers or force conventional edits", () => {
    const prompt = buildReoptimizationPrompt("{\"test\":true}");
    expect(prompt).toContain("Do not imitate or claim to be any living marketer");
    expect(prompt).toContain("Do not recommend a new title, H1, FAQ, word count, or rewrite merely because it is conventional");
    expect(prompt).toContain("Nathan Gotch's public content-upgrade sequence");
    expect(prompt).toContain("Neil Patel's public content-refresh guidance");
    expect(prompt).toContain("return the complete proposed H1-H6 outline");
    expect(prompt).toContain("Primary phrase: use the supplied target keyword");
    expect(prompt).toContain("Do not remove a relevant variant merely because it resembles the primary keyword");
    expect(prompt).toContain("Return one heading decision for every verified current heading");
    const request = buildAnthropicReoptimizationRequest(prompt, "claude-opus-4-8");
    expect(request.output_config.format.schema.properties.checklist.minItems).toBe(13);
    expect(request.output_config.format.schema.required).toContain("headingPlan");
    expect(request.output_config.format.schema.required).toContain("keywordFramework");
    expect(request.output_config.format.schema.required).toContain("headingDecisions");
  });

  it("keeps a complete, typed recommended heading plan", () => {
    const strategy = parseReoptimizationStrategy(validPayload());
    expect(strategy.headingPlan.recommended).toEqual([
      { level: "H1", text: "YouTube Ads Agency", purpose: "State the primary service.", source: "revised" },
      { level: "H2", text: "How the engagement works", purpose: "Explain the buying process.", source: "new" },
    ]);
  });

  it("keeps primary, secondary, and related keyword roles separate", () => {
    const strategy = parseReoptimizationStrategy(validPayload());
    expect(strategy.keywordFramework).toEqual({
      primary: "youtube ads agency",
      secondary: ["youtube advertising agency", "youtube ad agency", "youtube ads services"],
      related: ["youtube ad strategy", "youtube video ad production", "youtube campaign management"],
    });
    expect(strategy.headingDecisions[1]).toEqual(expect.objectContaining({
      action: "replace",
      recommendedText: "YouTube Ads Services",
    }));
  });

  it("turns verified site pages into a concrete re-optimization link plan without inventing URLs", () => {
    const strategy = parseReoptimizationStrategy(validPayload());
    const planned = applyVerifiedInternalLinkPlan(strategy, [
      { title: "YouTube SEO services", url: "https://example.com/youtube-seo", text: "YouTube SEO services" },
      { title: "Video production", url: "https://example.com/video-production", text: "YouTube video production" },
      { title: "Campaign reporting", url: "https://example.com/reporting", text: "YouTube campaign reporting" },
      { title: "Foreign", url: "https://other.example/page", text: "YouTube ads" },
    ], "https://example.com/youtube-ads", "Our YouTube ads page covers SEO, video production, and campaign reporting.");
    const item = planned.checklist.find((candidate) => candidate.id === "internal-links");
    expect(item?.recommended).toContain("https://example.com/youtube-seo");
    expect(item?.recommended).toContain("https://example.com/video-production");
    expect(item?.recommended).toContain("https://example.com/reporting");
    expect(item?.recommended).not.toContain("other.example");
    expect(item?.evidence).toHaveLength(3);
  });
});
