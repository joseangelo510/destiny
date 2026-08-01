import { describe, expect, it } from "vitest";
import { stepOneValidation } from "./validation";

describe("stepOneValidation", () => {
  it("accepts and normalizes a bare public domain", () => {
    expect(stepOneValidation({
      businessName: "Empowerly",
      website: "empowerly.com",
      business: "College counseling services for high school students",
    })).toEqual({ ready: true, normalizedWebsite: "https://empowerly.com/" });
  });

  it("accepts a full public URL", () => {
    expect(stepOneValidation({
      businessName: "Jose Angelo Studios",
      website: "https://www.joseangelostudios.com/services",
      business: "SEO and growth strategy",
    })).toEqual({ ready: true, normalizedWebsite: "https://www.joseangelostudios.com/services" });
  });

  it("keeps the step blocked for an invalid or incomplete website", () => {
    expect(stepOneValidation({ businessName: "Local", website: "localhost", business: "Services" }).ready).toBe(false);
    expect(stepOneValidation({ businessName: "", website: "example.com", business: "Services" }).ready).toBe(false);
    expect(stepOneValidation({ businessName: "Local", website: "example.com", business: "" }).ready).toBe(false);
  });
});
