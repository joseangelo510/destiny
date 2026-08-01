import { describe, expect, it } from "vitest";
import { safeInternalPath } from "./redirect";

describe("safeInternalPath", () => {
  it("preserves a same-origin path and query", () => {
    expect(safeInternalPath("/api/integrations/google/start?provider=youtube&websiteId=abc"))
      .toBe("/api/integrations/google/start?provider=youtube&websiteId=abc");
  });

  it.each([
    "https://attacker.example/path",
    "//attacker.example/path",
    "/\\attacker.example/path",
    "javascript:alert(1)",
    "not-a-path",
  ])("rejects an external or malformed destination: %s", (value) => {
    expect(safeInternalPath(value)).toBe("/app");
  });

  it("falls back for missing values", () => {
    expect(safeInternalPath(undefined)).toBe("/app");
  });
});
