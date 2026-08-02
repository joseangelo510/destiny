import { describe, expect, it } from "vitest";
import { SEARCH_INTENT_DEFINITIONS, buildEditorialCalendar } from "./editorial-calendar";

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
    expect(calendar.every((item) => item.focusKeyword && item.contentType && item.evidence)).toBe(true);
    expect(new Set(calendar.map((item) => item.searchIntent))).toEqual(new Set(["awareness", "consideration", "conversion"]));
  });

  it("keeps content type and search intent as separate editorial decisions", () => {
    const calendar = buildEditorialCalendar([
      { keyword: "college admissions counseling", opportunity: "competitor_gap", searchVolume: 500, difficulty: 31 },
    ]);

    expect(calendar[0]).toMatchObject({ contentType: "Blog guide", searchIntent: "awareness" });
    expect(calendar[1]).toMatchObject({ contentType: "FAQ article", searchIntent: "awareness" });
    expect(calendar[3]).toMatchObject({ contentType: "Comparison page", searchIntent: "consideration" });
    expect(calendar[8]).toMatchObject({ contentType: "Pricing guide", searchIntent: "conversion" });
    expect(calendar[21]).toMatchObject({ contentType: "Service page", searchIntent: "conversion" });
    expect(calendar[23]).toMatchObject({ contentType: "Landing page", searchIntent: "conversion" });
  });

  it("explains each search-intent stage in customer language", () => {
    expect(SEARCH_INTENT_DEFINITIONS.awareness.description).toMatch(/learning|research/i);
    expect(SEARCH_INTENT_DEFINITIONS.consideration.description).toMatch(/compar|evaluat/i);
    expect(SEARCH_INTENT_DEFINITIONS.conversion.description).toMatch(/pricing|buy|hire|sign up/i);
  });

  it("returns no invented calendar when there are no approved keywords", () => {
    expect(buildEditorialCalendar([])).toEqual([]);
  });
});
