import { describe, expect, it } from "vitest";
import { BRAND_INITIAL, BRAND_NAME, displayGeneratedBy } from "./branding";

describe("Rebound SEO branding", () => {
  it("defines the customer-facing product identity", () => {
    expect(BRAND_NAME).toBe("Rebound SEO");
    expect(BRAND_INITIAL).toBe("R");
  });

  it("maps legacy interview provenance without rewriting stored data", () => {
    expect(displayGeneratedBy("Destiny Interviews")).toBe("Rebound SEO Interviews");
    expect(displayGeneratedBy("claude-sonnet")).toBe("claude-sonnet");
    expect(displayGeneratedBy(undefined)).toBeUndefined();
  });
});
