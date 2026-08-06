import { describe, expect, it } from "vitest";
import { onboardingBusinessColumns } from "./persistence";

describe("onboardingBusinessColumns", () => {
  it("maps the three step-two answers without writing the deprecated audience-goals column", () => {
    const values = onboardingBusinessColumns({
      productsServices: "Tax prep and monthly accounting",
      customer: "Restaurants and contractors",
      problem: "They are behind on their books",
      standout: "Thirty years of local experience",
    });

    expect(values).toEqual({
      products_services: "Tax prep and monthly accounting",
      ideal_customer: "Restaurants and contractors",
      problem_solved: "They are behind on their books",
      differentiation: "Thirty years of local experience",
    });
    expect(values).not.toHaveProperty("audience_challenges_goals");
  });
});
