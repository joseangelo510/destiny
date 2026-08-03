import { describe, expect, it } from "vitest";
import { organicHistoryWindowStart, parseOrganicPerformance } from "./logic";

const successfulPayload = (items: unknown[]) => ({
  status_code: 20000,
  tasks: [{ status_code: 20000, result: [{ items }] }],
});

describe("organic performance history", () => {
  it("returns the latest three months in chronological order with traffic and ranking coverage", () => {
    const points = parseOrganicPerformance(successfulPayload([
      { year: 2026, month: 8, metrics: { organic: { etv: 145.8, count: 72, pos_1: 3, pos_2_3: 7, pos_4_10: 15 } } },
      { year: 2026, month: 6, metrics: { organic: { etv: 91.1, count: 49, pos_1: 1, pos_2_3: 4, pos_4_10: 9 } } },
      { year: 2026, month: 7, metrics: { organic: { etv: 118.4, count: 61, pos_1: 2, pos_2_3: 5, pos_4_10: 12 } } },
      { year: 2026, month: 5, metrics: { organic: { etv: 70, count: 40 } } },
    ]));

    expect(points).toEqual([
      { date: "2026-06-01", traffic: 91, keywords: 49, top3: 5, top10: 14 },
      { date: "2026-07-01", traffic: 118, keywords: 61, top3: 7, top10: 19 },
      { date: "2026-08-01", traffic: 146, keywords: 72, top3: 10, top10: 25 },
    ]);
  });

  it("returns the first day three calendar months before the reference date", () => {
    expect(organicHistoryWindowStart(new Date("2026-08-03T15:00:00Z"))).toBe("2026-05-01");
  });

  it("rejects provider failures instead of drawing invented history", () => {
    expect(() => parseOrganicPerformance({ status_code: 20000, tasks: [{ status_code: 40501, status_message: "Invalid target" }] })).toThrow("Invalid target");
  });
});
