import { describe, expect, it } from "vitest";
import { stepOneValidation, stepTwoValidation } from "./validation";

describe("stepOneValidation", () => {
  it("accepts and normalizes a bare public domain", () => {
    expect(stepOneValidation({
      businessName: "Empowerly",
      website: "empowerly.com",
      productsServices: "College admissions counseling and application support",
      problem: "Families need a clear path through college admissions",
    })).toEqual({ ready: true, normalizedWebsite: "https://empowerly.com/" });
  });

  it("accepts a full public URL", () => {
    expect(stepOneValidation({
      businessName: "Jose Angelo Studios",
      website: "https://www.joseangelostudios.com/services",
      productsServices: "SEO strategy, content, and distribution services",
      problem: "Growing companies need an accountable search growth system",
    })).toEqual({ ready: true, normalizedWebsite: "https://www.joseangelostudios.com/services" });
  });

  it("keeps the step blocked for an invalid or incomplete website", () => {
    expect(stepOneValidation({ businessName: "Local", website: "localhost", productsServices: "A real offer", problem: "A real problem" }).ready).toBe(false);
    expect(stepOneValidation({ businessName: "", website: "example.com", productsServices: "A real offer", problem: "A real problem" }).ready).toBe(false);
    expect(stepOneValidation({ businessName: "Local", website: "example.com", productsServices: "", problem: "A real problem" }).ready).toBe(false);
    expect(stepOneValidation({ businessName: "Local", website: "example.com", productsServices: "A real offer", problem: "" }).ready).toBe(false);
  });
});

describe("stepTwoValidation", () => {
  it("requires the ideal customer, their challenges and goals, and a search country", () => {
    expect(stepTwoValidation({ customer: "Startup marketing teams", audienceGoals: "Increase qualified traffic and reduce manual work", country: "United States" })).toEqual({ ready: true });
    expect(stepTwoValidation({ customer: "", audienceGoals: "Increase qualified traffic", country: "United States" })).toEqual({ ready: false });
    expect(stepTwoValidation({ customer: "Startup marketing teams", audienceGoals: "", country: "United States" })).toEqual({ ready: false });
    expect(stepTwoValidation({ customer: "Startup marketing teams", audienceGoals: "Increase qualified traffic", country: "" })).toEqual({ ready: false });
  });
});
