import { describe, expect, it } from "vitest";
import { PLAN_TIERS } from "./weekly-plan";

describe("weekly implementation plans", () => {
  it("defines the three plans by effort and task count", () => {
    expect(PLAN_TIERS.map((tier) => [tier.id, tier.taskCount, tier.minutes])).toEqual([
      ["beginner", 3, 30],
      ["moderate", 5, 60],
      ["super_growth", 8, 120],
    ]);
  });

});
