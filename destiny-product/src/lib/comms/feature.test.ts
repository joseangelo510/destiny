import { describe, expect, it } from "vitest";
import { isCommsBetaEnabled } from "./feature";

describe("Destiny comms beta feature flag", () => {
  it("is disabled unless explicitly enabled", () => {
    expect(isCommsBetaEnabled({})).toBe(false);
    expect(isCommsBetaEnabled({ DESTINY_COMMS_BETA_ENABLED: "false" })).toBe(false);
    expect(isCommsBetaEnabled({ DESTINY_COMMS_BETA_ENABLED: "true" })).toBe(true);
  });

  it("requires a second explicit approval in production", () => {
    expect(isCommsBetaEnabled({ NODE_ENV: "production", DESTINY_COMMS_BETA_ENABLED: "true" })).toBe(false);
    expect(isCommsBetaEnabled({ NODE_ENV: "production", DESTINY_COMMS_BETA_ENABLED: "true", DESTINY_COMMS_BETA_PRODUCTION_ENABLED: "false" })).toBe(false);
    expect(isCommsBetaEnabled({ NODE_ENV: "production", DESTINY_COMMS_BETA_ENABLED: "true", DESTINY_COMMS_BETA_PRODUCTION_ENABLED: "true" })).toBe(true);
  });
});
