import { describe, expect, it } from "vitest";
import {
  INITIAL_KEYWORD_APPROVAL_TARGET,
  INITIAL_PLAN_MONTHS,
  INITIAL_PLAN_WEEKS,
  WEEKS_PER_PLAN_MONTH,
} from "./plan-horizon";

describe("Rebound SEO starter plan horizon", () => {
  it("includes one three-month planning cycle", () => {
    expect(INITIAL_PLAN_MONTHS).toBe(3);
    expect(WEEKS_PER_PLAN_MONTH).toBe(4);
    expect(INITIAL_PLAN_WEEKS).toBe(12);
  });

  it("starts the plan after five approved keywords", () => {
    expect(INITIAL_KEYWORD_APPROVAL_TARGET).toBe(5);
  });
});
