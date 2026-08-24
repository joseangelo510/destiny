import { describe, expect, it } from "vitest";
import { keywordQualityGate, type KeywordBusinessContext } from "./keyword-opportunity";

const junkRemovalContext: KeywordBusinessContext = {
  businessName: "98 Junk It",
  productsServices: "Residential and commercial junk removal, hauling, cleanouts, furniture removal, and appliance removal",
  problemSolved: "We help property owners remove unwanted junk quickly",
  idealCustomer: "Homeowners, property managers, and businesses in Fremont and the San Francisco Bay Area",
  audienceChallengesGoals: "Customers need reliable same-day hauling without hidden fees",
  differentiation: "Local team with transparent pricing and hundreds of five-star reviews",
  locationEvidence: "Fremont and the San Francisco Bay Area",
};

describe("keyword quality gate", () => {
  it("accepts a measured phrase that names the real service", () => {
    expect(keywordQualityGate({
      keyword: "commercial junk removal service",
      searchVolume: 260,
      intent: "commercial",
      opportunity: "site_idea",
    }, junkRemovalContext)).toEqual({ accepted: true, rejectionReasons: [] });
  });

  it("rejects zero-demand phrases before they can reach the owner", () => {
    expect(keywordQualityGate({ keyword: "same day junk removal fremont", searchVolume: 0 }, junkRemovalContext)).toEqual({
      accepted: false,
      rejectionReasons: ["no_measured_demand"],
    });
  });

  it.each([
    "customers need fast",
    "earned 205 star reviews",
    "serve fremont",
  ])("rejects copied business-language fragments: %s", (keyword) => {
    expect(keywordQualityGate({ keyword, searchVolume: 90 }, junkRemovalContext)).toMatchObject({
      accepted: false,
      rejectionReasons: expect.arrayContaining(["not_a_search_phrase"]),
    });
  });

  it("rejects an unrelated software category for a service business", () => {
    expect(keywordQualityGate({ keyword: "real estate CRM", searchVolume: 1_000 }, junkRemovalContext)).toEqual({
      accepted: false,
      rejectionReasons: ["unsupported_business_model"],
    });
  });
});
