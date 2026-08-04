import { describe, expect, it } from "vitest";
import { assertRecommendationManifest, encodeAuditIssues } from "./recommendation-policy";

describe("LOGOS recommendation adapter", () => {
  it("marshals issue evidence without choosing the winning recommendation", () => {
    expect(encodeAuditIssues([
      { code: "no_title", severity: "warning" },
      { code: "high_loading_time", severity: "critical" },
      { code: "future_provider_check", severity: "warning" },
    ])).toEqual({
      criticalHighLoading: 1,
      warningNoTitle: 1,
      unknownIssueCount: 1,
    });
  });

  it("rejects inconsistent manifest metadata instead of silently dropping decisions", () => {
    expect(() => assertRecommendationManifest({
      weeklyTaskManifest: ["keyword_review"],
      weeklyTaskApprovals: [],
      weeklyTaskTiers: [1],
      weeklyTaskPriorities: [1],
      weeklyTaskCount: 1,
    } as never)).toThrow("inconsistent weekly recommendation metadata");
  });
});
