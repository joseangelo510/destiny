import { describe, expect, it } from "vitest";
import { isCommsBetaEnabled } from "./feature";

describe("Destiny comms beta feature flag", () => {
  it("is disabled unless explicitly enabled", () => {
    expect(isCommsBetaEnabled({})).toBe(false);
    expect(isCommsBetaEnabled({ DESTINY_COMMS_BETA_ENABLED: "false" })).toBe(false);
    expect(isCommsBetaEnabled({ DESTINY_COMMS_BETA_ENABLED: "true" })).toBe(true);
  });
});
