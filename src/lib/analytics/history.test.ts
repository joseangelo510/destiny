import { describe, expect, it } from "vitest";
import { buildLinePath, formatHistoricalCount, latestHistoryPoints } from "./history";

const history = [
  { year: 2026, month: 4, organicTraffic: 90, rankingKeywords: 11 },
  { year: 2026, month: 6, organicTraffic: 140, rankingKeywords: 18 },
  { year: 2026, month: 5, organicTraffic: 120, rankingKeywords: 15 },
  { year: 2026, month: 7, organicTraffic: 175, rankingKeywords: 22 },
];

describe("historical SEO charts", () => {
  it("sorts and limits provider history to the latest three months", () => {
    expect(latestHistoryPoints(history, 3).map((point) => `${point.year}-${point.month}`)).toEqual([
      "2026-5", "2026-6", "2026-7",
    ]);
  });

  it("builds a stable SVG line even when values are equal", () => {
    expect(buildLinePath([10, 10, 10], 300, 120)).toBe("M 12 60 L 150 60 L 288 60");
  });

  it("formats estimated visits and keyword counts as whole human quantities", () => {
    expect(formatHistoricalCount(736359.319)).toBe("736,359");
    expect(formatHistoricalCount(Number.NaN)).toBe("—");
  });
});
