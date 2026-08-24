import { describe, expect, it } from "vitest";
import { buildInAppRankingReport } from "./in-app-ranking-report";

describe("in-app ranking report", () => {
  it("reconciles the report to fresh saved observations", () => {
    const report = buildInAppRankingReport([
      { keyword: "youtube seo agency", currentPosition: 3, currentFound: true, previousPosition: 7, previousFound: true, observedAt: "2026-08-23T16:00:00Z" },
      { keyword: "youtube ads agency", currentPosition: 18, currentFound: true, previousPosition: null, previousFound: null, observedAt: "2026-08-22T16:00:00Z" },
      { keyword: "ai seo services", currentPosition: null, currentFound: false, previousPosition: 92, previousFound: true, observedAt: "2026-08-23T17:00:00Z" },
    ], "2026-08-23T20:00:00Z");

    expect(report.state).toBe("ready");
    expect(report.summary).toMatchObject({ movedUp: 1, movedDown: 1, baselines: ["youtube ads agency"] });
    expect(report.topRanked[0]).toMatchObject({ keyword: "youtube seo agency", position: 3 });
    expect(report.notVisible).toEqual(["ai seo services"]);
    expect(report.evidenceAt).toBe("2026-08-23T17:00:00Z");
  });

  it("waits honestly when no reading is fresh enough for this report", () => {
    const report = buildInAppRankingReport([
      { keyword: "old reading", currentPosition: 8, currentFound: true, previousPosition: 10, previousFound: true, observedAt: "2026-08-01T12:00:00Z" },
    ], "2026-08-23T20:00:00Z");

    expect(report.state).toBe("waiting_for_fresh_readings");
    expect(report.summary.keywordsCompared).toBe(0);
    expect(report.topRanked).toEqual([]);
  });

  it("never turns not found into a fabricated position zero", () => {
    const report = buildInAppRankingReport([
      { keyword: "commercial junk removal", currentPosition: 0, currentFound: false, previousPosition: null, previousFound: null, observedAt: "2026-08-23T19:00:00Z" },
    ], "2026-08-23T20:00:00Z");

    expect(report.notVisible).toEqual(["commercial junk removal"]);
    expect(report.topRanked).toEqual([]);
  });
});
