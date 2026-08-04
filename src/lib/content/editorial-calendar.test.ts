import { describe, expect, it } from "vitest";
import {
  SEARCH_INTENT_DEFINITIONS,
  buildEditorialCalendar,
  inferBusinessModel,
  prioritizeEditorialKeywords,
  selectKeywordsForCalendar,
} from "./editorial-calendar";

describe("three-month editorial calendar", () => {
  it("fills all 12 weeks from a smaller approved keyword set", async () => {
    const calendar = await buildEditorialCalendar([
      { keyword: "college admissions counseling", intent: "commercial", opportunity: "competitor_gap", searchVolume: 500, difficulty: 31, rank: 0 },
      { keyword: "college essay coaching", intent: "informational", opportunity: "site_idea", searchVolume: 250, difficulty: 24, rank: 0 },
    ]);

    expect(calendar).toHaveLength(12);
    expect(calendar[0]).toMatchObject({ month: 1, week: 1, focusKeyword: "college admissions counseling" });
    expect(calendar[11]).toMatchObject({ month: 3, week: 4 });
    expect(new Set(calendar.map((item) => item.title)).size).toBe(12);
    expect(calendar.every((item) => item.focusKeyword && item.contentType && item.evidence)).toBe(true);
    expect(new Set(calendar.map((item) => item.searchIntent))).toEqual(new Set(["awareness", "consideration"]));
  });

  it("starts the schedule with revenue-oriented content formats", async () => {
    const calendar = await buildEditorialCalendar([
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

  it("uses product conversion pages for a product business", async () => {
    const calendar = await buildEditorialCalendar([
      { keyword: "house cleaning products", intent: "transactional", opportunity: "competitor_gap", searchVolume: 27_100, difficulty: 15 },
    ], 12, "product");

    expect(calendar.slice(0, 4).map((item) => item.contentType)).toEqual([
      "Product category page",
      "Comparison page",
      "Buying guide",
      "Product landing page",
    ]);
    expect(calendar[0].title).toMatch(/shop|buy|choose/i);
    expect(calendar[0].title).not.toMatch(/hire|service/i);
  });

  it("infers straightforward product and service business models from onboarding", async () => {
    await expect(inferBusinessModel("Reusable cleaning products, starter kits, bottles, and tablet refills")).resolves.toBe("product");
    await expect(inferBusinessModel("Residential lawn mowing, yard cleanup, maintenance, and seasonal services")).resolves.toBe("service");
  });

  it("keeps product-purchase keywords behind service revenue terms for a service business", async () => {
    const calendar = await buildEditorialCalendar([
      { keyword: "weed control lawn spray", intent: "transactional", opportunity: "competitor_gap", searchVolume: 1_300, difficulty: 0 },
      { keyword: "lawn care mowing service", intent: "commercial", opportunity: "site_idea", searchVolume: 27_100, difficulty: 26 },
    ], 12, "service");

    expect(calendar[0]).toMatchObject({
      focusKeyword: "lawn care mowing service",
      contentType: "Service page",
    });
  });

  it("prioritizes buying intent with real demand over raw informational volume", async () => {
    const prioritized = await prioritizeEditorialKeywords([
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

  it("puts a meaningful transactional opportunity ahead of a larger comparison term", async () => {
    const prioritized = await prioritizeEditorialKeywords([
      { keyword: "weed control lawn spray", intent: "transactional", opportunity: "competitor_gap", searchVolume: 1_300, difficulty: 0, cpc: 0 },
      { keyword: "lawn weed control", intent: "commercial", opportunity: "competitor_gap", searchVolume: 8_100, difficulty: 0, cpc: 10 },
    ], "product");

    expect(prioritized[0].keyword).toBe("weed control lawn spray");
    expect(prioritized[0].searchIntent).toBe("conversion");
  });

  it("does not let a zero-volume transactional phrase outrank a commercial term with demand", async () => {
    const prioritized = await prioritizeEditorialKeywords([
      { keyword: "buy unknown service", intent: "transactional", opportunity: "site_idea", searchVolume: 0, difficulty: 20, cpc: 9 },
      { keyword: "best local service", intent: "commercial", opportunity: "competitor_gap", searchVolume: 100, difficulty: 30, cpc: 4 },
    ]);

    expect(prioritized[0].keyword).toBe("best local service");
  });

  it("uses the prioritized keyword order for the first editorial topics", async () => {
    const calendar = await buildEditorialCalendar([
      { keyword: "how college essays work", intent: "informational", opportunity: "competitor_gap", searchVolume: 2_000, difficulty: 20, cpc: 0 },
      { keyword: "college counselor pricing", intent: "transactional", opportunity: "existing_rank", searchVolume: 180, difficulty: 28, rank: 9, cpc: 7 },
    ]);

    expect(calendar[0]).toMatchObject({
      focusKeyword: "college counselor pricing",
      searchIntent: "conversion",
      contentType: "Service page",
    });
  });

  it("keeps a local service calendar anchored to the offer and evidenced service area", async () => {
    const calendar = await buildEditorialCalendar([
      { keyword: "property managers near me", themeId: "audience-use-cases", themeLabel: "Audience use cases", intent: "transactional", opportunity: "site_idea", searchVolume: 40_500, difficulty: 26 },
      { keyword: "junk removal services in los angeles", intent: "commercial", opportunity: "site_idea", searchVolume: 590, difficulty: 8 },
      { keyword: "junk removal services boston", intent: "commercial", opportunity: "site_idea", searchVolume: 90, difficulty: 2 },
      { keyword: "commercial junk removal services", themeId: "products-services", themeLabel: "Products and services", intent: "commercial", opportunity: "site_idea", searchVolume: 590, difficulty: 0 },
      { keyword: "same day junk removal services", themeId: "products-services", themeLabel: "Products and services", intent: "commercial", opportunity: "site_idea", searchVolume: 320, difficulty: 4 },
      { keyword: "fremont junk removal", themeId: "products-services", themeLabel: "Products and services", intent: "transactional", opportunity: "existing_rank", searchVolume: 210, difficulty: 0, rank: 5 },
      { keyword: "junk removal san jose", intent: "commercial", opportunity: "site_idea", searchVolume: 70, difficulty: 12 },
    ], 12, "service", {
      productsServices: "Residential and commercial junk removal for homeowners, renters, and property managers; property cleanouts, furniture and appliance removal",
      locationEvidence: "Serving Fremont, San Jose, Livermore, Pleasanton, and Redwood City across the Bay Area",
    });

    expect(calendar.slice(0, 3).map((item) => item.focusKeyword)).toEqual(expect.arrayContaining([
      "commercial junk removal services",
      "same day junk removal services",
      "fremont junk removal",
    ]));
    expect(calendar.map((item) => item.focusKeyword)).not.toEqual(expect.arrayContaining([
      "property managers near me",
      "junk removal services in los angeles",
      "junk removal services boston",
    ]));
  });

  it("explains each search-intent stage in customer language", async () => {
    expect(SEARCH_INTENT_DEFINITIONS.awareness.description).toMatch(/learning|research/i);
    expect(SEARCH_INTENT_DEFINITIONS.consideration.description).toMatch(/compar|evaluat/i);
    expect(SEARCH_INTENT_DEFINITIONS.conversion.description).toMatch(/pricing|buy|hire|sign up/i);
  });

  it("returns no invented calendar when there are no approved keywords", async () => {
    await expect(buildEditorialCalendar([])).resolves.toEqual([]);
  });

  it("uses approved keyword decisions and excludes every declined keyword", async () => {
    const candidates = [
      { keyword: "college admissions consultant", intent: "commercial", searchVolume: 1_300 },
      { keyword: "college essay tips", intent: "informational", searchVolume: 8_100 },
      { keyword: "college counselor pricing", intent: "transactional", searchVolume: 260 },
    ];
    const selected = selectKeywordsForCalendar(candidates, {
      "college admissions consultant": "approved",
      "college essay tips": "declined",
      "college counselor pricing": "approved",
    });

    expect(selected.map((item) => item.keyword)).toEqual([
      "college admissions consultant",
      "college counselor pricing",
    ]);
  });

  it("keeps unreviewed automatic calendars on demand-backed keywords", async () => {
    const selected = selectKeywordsForCalendar([
      { keyword: "commercial junk removal services", searchVolume: 590 },
      { keyword: "bay area for years", searchVolume: 0 },
      { keyword: "reliable way remove unwanted furniture", searchVolume: 0 },
    ], {});

    expect(selected.map((item) => item.keyword)).toEqual(["commercial junk removal services"]);
  });

  it("honors an explicit approval even when provider volume is zero", async () => {
    const selected = selectKeywordsForCalendar([
      { keyword: "commercial junk removal services", searchVolume: 590 },
      { keyword: "same-day cleanout coordination", searchVolume: 0 },
    ], { "same-day cleanout coordination": "approved" });

    expect(selected.map((item) => item.keyword)).toEqual(["same-day cleanout coordination"]);
  });

  it("keeps competitor brands, freebie intent, and national phrases out of an automatic local-service calendar", async () => {
    const selected = selectKeywordsForCalendar([
      { keyword: "commercial junk removal services", searchVolume: 590 },
      { keyword: "fremont junk removal", searchVolume: 210 },
      { keyword: "loadup junk removal", searchVolume: 14_800 },
      { keyword: "junkman junk removal", searchVolume: 390 },
      { keyword: "free junk removal services", searchVolume: 210 },
      { keyword: "junk removal services in usa", searchVolume: 10 },
      { keyword: "ready set junk pricing", searchVolume: 90 },
    ], {}, {
      productsServices: "Residential and commercial junk removal with free estimates",
      locationEvidence: "Serving Fremont and the Bay Area",
      competitorNames: ["Ready Set Junk"],
    });

    expect(selected.map((item) => item.keyword)).toEqual([
      "commercial junk removal services",
      "fremont junk removal",
    ]);
  });

  it("still honors explicit approval for a competitor term", async () => {
    const selected = selectKeywordsForCalendar([
      { keyword: "loadup junk removal", searchVolume: 14_800 },
    ], { "loadup junk removal": "approved" }, {
      productsServices: "Junk removal",
      locationEvidence: "Serving Fremont and the Bay Area",
    });

    expect(selected.map((item) => item.keyword)).toEqual(["loadup junk removal"]);
  });

  it("keeps priority ties deterministic and cuts a 13th keyword after 12 slots", async () => {
    const candidates = Array.from({ length: 13 }, (_, index) => ({
      keyword: `service option ${String(index + 1).padStart(2, "0")}`,
      intent: "commercial",
      opportunity: "competitor_gap",
      searchVolume: 100,
      difficulty: 20,
    }));
    const first = await prioritizeEditorialKeywords(candidates);
    const second = await prioritizeEditorialKeywords(candidates);
    expect(first.map((item) => item.keyword)).toEqual(second.map((item) => item.keyword));
    const calendar = await buildEditorialCalendar(candidates);
    expect(calendar).toHaveLength(12);
    expect(new Set(calendar.map((item) => item.focusKeyword)).size).toBe(12);
    expect(calendar.map((item) => item.focusKeyword)).not.toContain("service option 13");
  });

  it("maps all three funnel stages deterministically when eligible demand supports them", async () => {
    const calendar = await buildEditorialCalendar([
      { keyword: "hire admissions consultant", intent: "transactional", searchVolume: 100 },
      { keyword: "best admissions consultant", intent: "commercial", searchVolume: 100 },
      { keyword: "how admissions consulting works", intent: "informational", searchVolume: 100 },
    ]);
    expect(new Set(calendar.map((item) => item.searchIntent))).toEqual(new Set(["conversion", "consideration", "awareness"]));
  });
});
