import { describe, expect, it } from "vitest";
import {
  baseDirectories,
  creatorProspects,
  directoryProfileMatches,
  isPaidPlan,
  recommendedDirectories,
  recommendedSocialChannels,
} from "./recommendations";

describe("distribution recommendations", () => {
  it("keeps the base directory registry consistent across Distribution and Reviews", () => {
    expect(baseDirectories.map((item) => item.name)).toEqual([
      "Google Business Profile",
      "Yelp",
      "Apple Maps",
      "Product Hunt",
      "G2",
      "Capterra",
    ]);
  });

  it("recommends industry-specific directories instead of a generic list", () => {
    const agencies = recommendedDirectories("A marketing and web design agency for growing brands");
    expect(agencies.map((item) => item.name)).toEqual(expect.arrayContaining(["Clutch", "DesignRush"]));
    const restaurants = recommendedDirectories("A neighborhood restaurant and cafe");
    expect(restaurants.map((item) => item.name)).toEqual(expect.arrayContaining(["Bing Places", "Yellow Pages", "Tripadvisor"]));
  });

  it("adds Facebook to the free social set and tailors paid suggestions", () => {
    expect(recommendedSocialChannels("local junk removal").base.map((item) => item.name)).toContain("Facebook");
    expect(recommendedSocialChannels("local junk removal").additional.map((item) => item.name)).toContain("Nextdoor");
  });

  it("accepts only the expected public host for each directory profile", () => {
    expect(directoryProfileMatches("yelp", "https://www.yelp.com/biz/example")).toBe(true);
    expect(directoryProfileMatches("google-business-profile", "https://maps.google.com/?cid=123")).toBe(true);
    expect(directoryProfileMatches("yelp", "https://example.com/fake-yelp-profile")).toBe(false);
  });

  it("recognizes only upgraded product plans as paid", () => {
    expect(isPaidPlan("beginner")).toBe(false);
    expect(isPaidPlan("moderate")).toBe(true);
    expect(isPaidPlan("super_growth")).toBe(true);
  });

  it("filters major media and labels creator evidence without inventing follower counts", () => {
    const rows = creatorProspects([
      { domain: "forbes.com", title: "Big media", url: "https://forbes.com/a", keyword: "junk removal" },
      { domain: "medium.com", title: "A practical local guide", url: "https://medium.com/a", keyword: "junk removal" },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ platform: "Medium", audience: "Audience size needs verification" });
  });

  it("filters reference sites, marketplaces, and giant publications from creator prospects", () => {
    const rows = creatorProspects([
      { domain: "en.wikipedia.org", title: "Reference result", url: "https://en.wikipedia.org/wiki/Junk_removal" },
      { domain: "amazon.com", title: "Marketplace result", url: "https://amazon.com/example" },
      { domain: "news.yahoo.com", title: "Mass media result", url: "https://news.yahoo.com/example" },
      { domain: "reddit.com", title: "Community result", url: "https://reddit.com/r/example" },
      { domain: "bayareamovingguide.com", title: "Independent local publisher", url: "https://bayareamovingguide.com/junk-removal" },
    ]);

    expect(rows).toEqual([
      expect.objectContaining({ domain: "bayareamovingguide.com", platform: "Independent blog" }),
    ]);
  });

  it("labels government and EU institution results as official sources", () => {
    const rows = creatorProspects([
      { domain: "digital-strategy.ec.europa.eu", url: "https://digital-strategy.ec.europa.eu/policies/regulatory-framework-ai", title: "AI Act" },
      { domain: "example.gov.uk", url: "https://example.gov.uk/guidance", title: "Guidance" },
    ]);

    expect(rows.map((row) => row.platform)).toEqual(["Official source", "Official source"]);
  });
});
