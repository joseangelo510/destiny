import { describe, expect, it } from "vitest";
import {
  SEARCH_INTENT_DEFINITIONS,
  buildEditorialCalendar,
  inferBusinessModel,
  prioritizeEditorialKeywords,
} from "./editorial-calendar";

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
    expect(new Set(calendar.map((item) => item.searchIntent))).toEqual(new Set(["awareness", "consideration"]));
  });

  it("starts the schedule with revenue-oriented content formats", () => {
    const calendar = buildEditorialCalendar([
      { keyword: "hire a college admissions counselor", intent: "transactional", opportunity: "competitor_gap", searchVolume: 500, difficulty: 31, cpc: 8 },
    ]);

    expect(calendar.slice(0, 4).map((item) => item.contentType)).toEqual([
      "Service page",
      "Comparison page",
      "Pricing guide",
      "Landing page",
    ]);
    expect(calendar[0]).toMatchObject({ searchIntent: "conversion" });
  });

  it("uses product conversion pages for a product business", () => {
    const calendar = buildEditorialCalendar([
      { keyword: "house cleaning products", intent: "transactional", opportunity: "competitor_gap", searchVolume: 27_100, difficulty: 15 },
    ], 24, "product");

    expect(calendar.slice(0, 4).map((item) => item.contentType)).toEqual([
      "Product category page",
      "Comparison page",
      "Buying guide",
      "Product landing page",
    ]);
    expect(calendar[0].title).toMatch(/shop|buy|choose/i);
    expect(calendar[0].title).not.toMatch(/hire|service/i);
  });

  it("infers straightforward product and service business models from onboarding", () => {
    expect(inferBusinessModel("Reusable cleaning products, starter kits, bottles, and tablet refills")).toBe("product");
    expect(inferBusinessModel("Residential lawn mowing, yard cleanup, maintenance, and seasonal services")).toBe("service");
  });

  it("keeps product-purchase keywords behind service revenue terms for a service business", () => {
    const calendar = buildEditorialCalendar([
      { keyword: "weed control lawn spray", intent: "transactional", opportunity: "competitor_gap", searchVolume: 1_300, difficulty: 0 },
      { keyword: "lawn care mowing service", intent: "commercial", opportunity: "site_idea", searchVolume: 27_100, difficulty: 26 },
    ], 24, "service");

    expect(calendar[0]).toMatchObject({
      focusKeyword: "lawn care mowing service",
      contentType: "Service page",
    });
  });

  it("prioritizes buying intent with real demand over raw informational volume", () => {
    const prioritized = prioritizeEditorialKeywords([
      { keyword: "hire a college admissions counselor", intent: "transactional", opportunity: "existing_rank", searchVolume: 250, difficulty: 35, rank: 12, cpc: 8 },
      { keyword: "best college admissions counseling", intent: "commercial", opportunity: "competitor_gap", searchVolume: 600, difficulty: 30, cpc: 5 },
      { keyword: "what is college counseling", intent: "informational", opportunity: "competitor_gap", searchVolume: 5_000, difficulty: 20, cpc: 0 },
    ]);

    expect(prioritized.map((item) => item.keyword)).toEqual([
      "hire a college admissions counselor",
      "best college admissions counseling",
      "what is college counseling",
    ]);
    expect(prioritized[0]).toMatchObject({ searchIntent: "conversion" });
    expect(prioritized[0].priorityReason).toMatch(/buying intent|rank #12|monthly searches/i);
  });

  it("puts a meaningful transactional opportunity ahead of a larger comparison term", () => {
    const prioritized = prioritizeEditorialKeywords([
      { keyword: "weed control lawn spray", intent: "transactional", opportunity: "competitor_gap", searchVolume: 1_300, difficulty: 0, cpc: 0 },
      { keyword: "lawn weed control", intent: "commercial", opportunity: "competitor_gap", searchVolume: 8_100, difficulty: 0, cpc: 10 },
    ], "product");

    expect(prioritized[0].keyword).toBe("weed control lawn spray");
    expect(prioritized[0].searchIntent).toBe("conversion");
  });

  it("does not let a zero-volume transactional phrase outrank a commercial term with demand", () => {
    const prioritized = prioritizeEditorialKeywords([
      { keyword: "buy unknown service", intent: "transactional", opportunity: "site_idea", searchVolume: 0, difficulty: 20, cpc: 9 },
      { keyword: "best local service", intent: "commercial", opportunity: "competitor_gap", searchVolume: 100, difficulty: 30, cpc: 4 },
    ]);

    expect(prioritized[0].keyword).toBe("best local service");
  });

  it("uses the prioritized keyword order for the first editorial topics", () => {
    const calendar = buildEditorialCalendar([
      { keyword: "how college essays work", intent: "informational", opportunity: "competitor_gap", searchVolume: 2_000, difficulty: 20, cpc: 0 },
      { keyword: "college counselor pricing", intent: "transactional", opportunity: "existing_rank", searchVolume: 180, difficulty: 28, rank: 9, cpc: 7 },
    ]);

    expect(calendar[0]).toMatchObject({
      focusKeyword: "college counselor pricing",
      searchIntent: "conversion",
      contentType: "Service page",
    });
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
