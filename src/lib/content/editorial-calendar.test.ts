import { describe, expect, it } from "vitest";
import { SEARCH_INTENT_DEFINITIONS, buildEditorialCalendar } from "./editorial-calendar";

const KEYWORDS = [
  { keyword: "college admissions counseling", intent: "commercial", opportunity: "competitor_gap", searchVolume: 500, difficulty: 31, rank: 0 },
  { keyword: "college essay coaching", intent: "informational", opportunity: "site_idea", searchVolume: 250, difficulty: 24, rank: 0 },
];

describe("six-month editorial calendar", () => {
  it("fills all 24 weeks with contentType, focusKeyword, and evidence across all three search intents", () => {
    const calendar = buildEditorialCalendar(KEYWORDS);

    expect(calendar).toHaveLength(24);
    expect(calendar[0]).toMatchObject({ month: 1, week: 1, focusKeyword: "college admissions counseling" });
    expect(calendar[23]).toMatchObject({ month: 6, week: 4 });
    expect(new Set(calendar.map((item) => item.title)).size).toBe(24);
    expect(calendar.every((item) => item.focusKeyword && item.contentType && item.evidence)).toBe(true);

    const intents = new Set(calendar.map((item) => item.searchIntent));
    expect(intents).toContain("awareness");
    expect(intents).toContain("consideration");
    expect(intents).toContain("conversion");
  });

  it("returns no invented calendar when there are no approved keywords", () => {
    expect(buildEditorialCalendar([])).toEqual([]);
  });

  it("maps the representative angles to the correct contentType and searchIntent", () => {
    const calendar = buildEditorialCalendar([{ keyword: "seo" }], 24);

    expect(calendar[0]).toMatchObject({ contentType: "Blog guide", searchIntent: "awareness" });
    expect(calendar[1]).toMatchObject({ contentType: "FAQ article", searchIntent: "awareness" });
    expect(calendar[2]).toMatchObject({ contentType: "Checklist", searchIntent: "consideration" });
    expect(calendar[3]).toMatchObject({ contentType: "Comparison page", searchIntent: "consideration" });
    expect(calendar[8]).toMatchObject({ contentType: "Pricing guide", searchIntent: "conversion" });
    expect(calendar[8].title).toMatch(/pricing/i);
    expect(calendar[21]).toMatchObject({ contentType: "Service page", searchIntent: "conversion" });
    expect(calendar[21].title).toBe("Where to hire help for seo");
    expect(calendar[23]).toMatchObject({ contentType: "Landing page", searchIntent: "conversion" });
    expect(calendar[23].title).toBe("Get started with seo: options, pricing, and next steps");
  });

  it("uses customer language in each search intent definition", () => {
    const awareness = SEARCH_INTENT_DEFINITIONS.awareness.description.toLowerCase();
    const consideration = SEARCH_INTENT_DEFINITIONS.consideration.description.toLowerCase();
    const conversion = SEARCH_INTENT_DEFINITIONS.conversion.description.toLowerCase();

    // Awareness mentions learning or research
    expect(awareness).toMatch(/learn|research/);
    // Consideration mentions comparing or evaluating
    expect(consideration).toMatch(/compar|evaluat/);
    // Conversion mentions pricing, buy, hire, or sign up
    expect(conversion).toMatch(/pric|buy|hire|sign up/);
  });
});
