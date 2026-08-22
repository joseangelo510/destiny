import { describe, expect, it } from "vitest";
import {
  OFFLINE_CMS_DESTINATION_POLICY,
  isOfflineCmsDestinationAllowed,
} from "../mocks/cms-adapters";

describe("offline CMS destination allowlist", () => {
  it("is structurally limited to reserved .invalid destinations", () => {
    expect(OFFLINE_CMS_DESTINATION_POLICY).toEqual({
      protocols: ["https:"],
      exactHostnames: ["invalid"],
      hostnameSuffixes: [".invalid"],
    });
    expect(isOfflineCmsDestinationAllowed("https://wordpress.qa.invalid")).toBe(true);
    expect(isOfflineCmsDestinationAllowed("https://invalid")).toBe(true);
  });

  it.each([
    "https://example.com",
    "https://example.org",
    "https://example.net",
    "https://example.app",
    "https://example.dev",
    "https://example.io",
    "https://example.co",
    "https://example.ai",
    "https://localhost",
    "https://127.0.0.1",
    "http://wordpress.qa.invalid",
    "https://user:password@wordpress.qa.invalid",
  ])("rejects every public, loopback, insecure, or credentialed destination: %s", (destination) => {
    expect(isOfflineCmsDestinationAllowed(destination)).toBe(false);
  });
});
