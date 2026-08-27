import { describe, expect, it } from "vitest";
import { classifyRankError, rankRetryPlan } from "./logic";

describe("rank tracker provider recovery", () => {
  it("classifies transient and permanent provider errors", () => {
    expect(classifyRankError("Internal SE Server Error.")).toBe("transient");
    expect(classifyRankError("DataForSEO returned HTTP 429.")).toBe("transient");
    expect(classifyRankError("DataForSEO returned HTTP 401.")).toBe("permanent");
    expect(classifyRankError("unsupported location code")).toBe("permanent");
    expect(classifyRankError("unexpected provider response")).toBe("transient");
  });

  it("uses bounded transient backoff and degrades after the fourth failure", () => {
    const now = new Date("2026-08-26T12:00:00.000Z");
    const first = rankRetryPlan("Internal SE Server Error.", null, now);
    expect(first).toMatchObject({ classification: "transient", attempt: 1, state: "retrying", nextCheckAt: "2026-08-26T13:00:00.000Z" });
    const second = rankRetryPlan("Internal SE Server Error.", first.lastError, now);
    expect(second).toMatchObject({ attempt: 2, state: "retrying", nextCheckAt: "2026-08-26T18:00:00.000Z" });
    const third = rankRetryPlan("Internal SE Server Error.", second.lastError, now);
    expect(third).toMatchObject({ attempt: 3, state: "retrying", nextCheckAt: "2026-08-27T12:00:00.000Z" });
    const fourth = rankRetryPlan("Internal SE Server Error.", third.lastError, now);
    expect(fourth).toMatchObject({ attempt: 4, state: "degraded", nextCheckAt: "2026-08-29T12:00:00.000Z" });
  });

  it("degrades permanent errors without rapid retries", () => {
    expect(rankRetryPlan("DataForSEO returned HTTP 402.", null, new Date("2026-08-26T12:00:00.000Z"))).toMatchObject({
      classification: "permanent",
      attempt: 1,
      state: "degraded",
      nextCheckAt: "2026-09-02T12:00:00.000Z",
    });
  });
});
