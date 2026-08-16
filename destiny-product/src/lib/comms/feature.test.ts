import { describe, expect, it } from "vitest";
import { isCommsBetaEnabled } from "./feature";

describe("Destiny comms beta feature flag", () => {
  it("is disabled unless local preview is explicitly enabled", () => {
    expect(isCommsBetaEnabled({})).toBe(false);
    expect(isCommsBetaEnabled({ DESTINY_COMMS_BETA_ENABLED: "false" })).toBe(false);
    expect(isCommsBetaEnabled({ DESTINY_COMMS_BETA_ENABLED: "true" })).toBe(false);
    expect(isCommsBetaEnabled({ NODE_ENV: "development", DESTINY_COMMS_BETA_ENABLED: "true", DESTINY_COMMS_BETA_LOCAL_PREVIEW: "true" })).toBe(true);
  });

  it("cannot be enabled by environment configuration in production", () => {
    expect(isCommsBetaEnabled({ NODE_ENV: "production", DESTINY_COMMS_BETA_ENABLED: "true", DESTINY_COMMS_BETA_LOCAL_PREVIEW: "true" })).toBe(false);
    expect(isCommsBetaEnabled({ NODE_ENV: "production", DESTINY_COMMS_BETA_ENABLED: "true", DESTINY_COMMS_BETA_LOCAL_PREVIEW: "true", DESTINY_COMMS_BETA_PRODUCTION_ENABLED: "true" })).toBe(false);
  });
});
