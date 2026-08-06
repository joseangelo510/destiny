import { describe, expect, it } from "vitest";
import { stepOneValidation, stepTwoValidation } from "./validation";

describe("stepOneValidation", () => {
  it("accepts and normalizes a bare public domain", async () => {
    await expect(stepOneValidation({
      firstName: "Maya",
      lastName: "Torres",
      email: "maya@empowerly.com",
      businessName: "Empowerly",
      website: "empowerly.com",
    })).resolves.toEqual({ ready: true, normalizedWebsite: "https://empowerly.com/" });
  });

  it("accepts a full public URL", async () => {
    await expect(stepOneValidation({
      firstName: "Jose",
      lastName: "Gallegos",
      email: "jose@joseangelostudios.com",
      businessName: "Jose Angelo Studios",
      website: "https://www.joseangelostudios.com/services",
    })).resolves.toEqual({ ready: true, normalizedWebsite: "https://www.joseangelostudios.com/services" });
  });

  it("requires contact details, business name, and a valid business website URL", async () => {
    const valid = { firstName: "Maya", lastName: "Torres", email: "maya@example.com", businessName: "Local", website: "example.com" };
    expect((await stepOneValidation({ ...valid, website: "Local Business" })).ready).toBe(false);
    expect((await stepOneValidation({ ...valid, firstName: "" })).ready).toBe(false);
    expect((await stepOneValidation({ ...valid, lastName: "" })).ready).toBe(false);
    expect((await stepOneValidation({ ...valid, email: "not-an-email" })).ready).toBe(false);
    expect((await stepOneValidation({ ...valid, businessName: "" })).ready).toBe(false);
  });
});

describe("stepTwoValidation", () => {
  it("requires the offer, customer, and problem only", async () => {
    const valid = {
      productsServices: "SEO strategy and content services",
      problem: "Small businesses cannot afford an agency",
      customer: "Startup marketing teams",
    };
    await expect(stepTwoValidation(valid)).resolves.toEqual({ ready: true });
    await expect(stepTwoValidation({ ...valid, productsServices: "" })).resolves.toEqual({ ready: false });
    await expect(stepTwoValidation({ ...valid, problem: "" })).resolves.toEqual({ ready: false });
    await expect(stepTwoValidation({ ...valid, customer: "" })).resolves.toEqual({ ready: false });
  });
});
