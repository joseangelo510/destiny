import { describe, expect, it } from "vitest";
import { stepOneValidation, stepTwoValidation } from "./validation";

describe("stepOneValidation", () => {
  it("accepts and normalizes a bare public domain", () => {
    expect(stepOneValidation({
      firstName: "Maya",
      lastName: "Torres",
      email: "maya@empowerly.com",
      businessName: "Empowerly",
      website: "empowerly.com",
    })).toEqual({ ready: true, normalizedWebsite: "https://empowerly.com/" });
  });

  it("accepts a full public URL", () => {
    expect(stepOneValidation({
      firstName: "Jose",
      lastName: "Gallegos",
      email: "jose@joseangelostudios.com",
      businessName: "Jose Angelo Studios",
      website: "https://www.joseangelostudios.com/services",
    })).toEqual({ ready: true, normalizedWebsite: "https://www.joseangelostudios.com/services" });
  });

  it("requires contact details, business name, and a valid business website URL", () => {
    const valid = { firstName: "Maya", lastName: "Torres", email: "maya@example.com", businessName: "Local", website: "example.com" };
    expect(stepOneValidation({ ...valid, website: "Local Business" }).ready).toBe(false);
    expect(stepOneValidation({ ...valid, firstName: "" }).ready).toBe(false);
    expect(stepOneValidation({ ...valid, lastName: "" }).ready).toBe(false);
    expect(stepOneValidation({ ...valid, email: "not-an-email" }).ready).toBe(false);
    expect(stepOneValidation({ ...valid, businessName: "" }).ready).toBe(false);
  });
});

describe("stepTwoValidation", () => {
  it("requires the offer, problem, ideal customer, and audience challenges and goals", () => {
    const valid = {
      productsServices: "SEO strategy and content services",
      problem: "Small businesses cannot afford an agency",
      customer: "Startup marketing teams",
      audienceGoals: "Increase qualified traffic and reduce manual work",
    };
    expect(stepTwoValidation(valid)).toEqual({ ready: true });
    expect(stepTwoValidation({ ...valid, productsServices: "" })).toEqual({ ready: false });
    expect(stepTwoValidation({ ...valid, problem: "" })).toEqual({ ready: false });
    expect(stepTwoValidation({ ...valid, customer: "" })).toEqual({ ready: false });
    expect(stepTwoValidation({ ...valid, audienceGoals: "" })).toEqual({ ready: false });
  });
});
