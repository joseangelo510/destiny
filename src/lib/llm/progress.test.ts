import { describe, expect, it } from "vitest";
import { AI_CITATION_BENCHMARK, buildAiVisibilityProgress } from "./progress";

describe("AI visibility progress", () => {
  it("keeps readiness actions separate from verified AI visibility", async () => {
    const progress = await buildAiVisibilityProgress({
      quests: [
        { task_type: "content_review", status: "complete", verification_status: null },
        { task_type: "community_distribution", status: "complete", verification_status: "verified" },
        { task_type: "publisher_outreach", status: "todo", verification_status: null },
      ],
      llmVisibility: { status: "unavailable", totalMentions: 0, platforms: [], topCitedDomains: [] },
    });

    expect(progress.readiness).toMatchObject({ completed: 2, total: 3 });
    expect(progress.verifiedVisibility).toMatchObject({ detected: false, totalMentions: 0 });
    expect(progress.stages.at(-1)).toMatchObject({ kind: "outcome", state: "not_started" });
    expect(progress.readiness.label).toMatch(/readiness actions/i);
    expect(progress.readiness.label).not.toMatch(/AI-visible|visibility score/i);
  });

  it("only marks the outcome verified when provider mention evidence exists", async () => {
    const progress = await buildAiVisibilityProgress({
      quests: [],
      llmVisibility: {
        status: "available",
        totalMentions: 14,
        platforms: [{ platform: "ChatGPT", mentions: 14 }],
        topCitedDomains: [{ domain: "reddit.com", mentions: 4 }],
      },
    });

    expect(progress.verifiedVisibility).toMatchObject({ detected: true, totalMentions: 14 });
    expect(progress.stages.at(-1)).toMatchObject({ kind: "outcome", state: "verified" });
  });

  it("versions the cited-domain benchmark and preserves the leading domains", async () => {
    expect(AI_CITATION_BENCHMARK.source).toMatch(/Semrush/i);
    expect(AI_CITATION_BENCHMARK.asOf).toBe("October 2025");
    expect(AI_CITATION_BENCHMARK.promptCount).toBe(230_000);
    expect(AI_CITATION_BENCHMARK.domains.slice(0, 5).map((item) => item.domain)).toEqual([
      "reddit.com",
      "linkedin.com",
      "wikipedia.org",
      "medium.com",
      "youtube.com",
    ]);
  });
});
