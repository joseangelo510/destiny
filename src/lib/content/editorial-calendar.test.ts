import { describe, expect, it } from "vitest";
import { buildEditorialCalendar } from "./editorial-calendar";

describe("six-month editorial calendar", () => {
  it("fills all 24 weeks from a smaller approved keyword set", () => {
    const calendar = buildEditorialCalendar([
      { keyword: "college admissions counseling", intent: "commercial", opportunity: "competitor_gap", searchVolume: 500, difficulty: 31, rank: 0 },
      { keyword: "college essay coaching", intent: "informational", opportunity: "site_idea", searchVolume: 250, difficulty: 24, rank: 0 },
    ]);

    expect(calendar).toHaveLength(24);
    expect(calendar[0]).toMatchObject({ month: 1, week: 1, focusKeyword: "college admissions counseling" });
    expect(calendar[23]).toMatchObject({ month: 6, week: 4 });
    expect(new Set(calendar.map((item) => item.title)).size).toBe(24);
    expect(calendar.every((item) => item.focusKeyword && item.type && item.evidence)).toBe(true);
  });

  it("returns no invented calendar when there are no approved keywords", () => {
    expect(buildEditorialCalendar([])).toEqual([]);
  });
});
