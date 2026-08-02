import { describe, expect, it } from "vitest";
import { PLAN_TIERS, buildWeekOneTasks } from "./weekly-plan";

describe("weekly implementation plans", () => {
  it("defines the three plans by effort and task count", () => {
    expect(PLAN_TIERS.map((tier) => [tier.id, tier.taskCount, tier.minutes])).toEqual([
      ["beginner", 3, 30],
      ["moderate", 5, 60],
      ["super_growth", 8, 120],
    ]);
  });

  it.each(PLAN_TIERS)("builds an actionable $label checklist", (tier) => {
    const tasks = buildWeekOneTasks({
      tier: tier.id,
      auditId: "audit-1",
      primaryQuest: "Publish the highest-opportunity page",
      contentKeyword: "college admissions counseling",
      hasVocabulary: true,
      distributionOpportunities: [
        { platform: "Reddit", title: "How should families choose a counselor?", url: "https://www.reddit.com/r/ApplyingToCollege/comments/abc123/example/" },
        { platform: "Quora", title: "What does a college counselor do?", url: "https://www.quora.com/What-does-a-college-counselor-do" },
      ],
    });
    expect(tasks).toHaveLength(tier.taskCount);
    expect(tasks.some((task) => task.type === "content_review" && task.requiresApproval)).toBe(true);
    expect(tasks.every((task) => task.actionPath && task.why && task.estimatedMinutes > 0)).toBe(true);
    expect(new Set(tasks.map((task) => task.title)).size).toBe(tasks.length);
  });
});
