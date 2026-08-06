import { describe, expect, it } from "vitest";
import {
  AI_BUILDER_TOOLS,
  WEBSITE_PLATFORMS,
  isValidBuilderToolSelection,
  isValidPlatformSelection,
  parseBuilderProfile,
  platformConnectAllowed,
  platformSavedMessage,
} from "./website-profile";

describe("website platform registry", () => {
  it("contains every requested platform with normalized names", () => {
    const labels = WEBSITE_PLATFORMS.map((platform) => platform.label);
    expect(labels).toEqual([
      "Wix", "Webflow", "Squarespace", "Shopify", "Lovable", "GoDaddy Website Builder",
      "Joomla", "Weebly", "Duda", "Drupal", "Sitecore", "WordPress", "Other",
    ]);
  });

  it("lists the three AI builder tools plus Other as metadata, not connections", () => {
    expect(AI_BUILDER_TOOLS.map((tool) => tool.label)).toEqual(["ChatGPT", "Claude", "Perplexity", "Other"]);
  });

  it("invariant: only platforms with a live connection implementation may render Connect", () => {
    for (const platform of WEBSITE_PLATFORMS) {
      expect(platformConnectAllowed(platform.id)).toBe(platform.id === "wordpress");
    }
    expect(platformConnectAllowed("wix")).toBe(false);
    expect(platformConnectAllowed("unknown")).toBe(false);
  });

  it("uses truthful saved wording — never Connected — for platforms without a live connection", () => {
    const message = platformSavedMessage("wix");
    expect(message).toBe("Saved. Destiny will tailor your SEO advice for Wix. A direct connection isn’t available yet, so we’ll show you where to make changes.");
    expect(message).not.toContain("Connected");
    expect(platformSavedMessage("wordpress")).toContain("connect WordPress directly under Connected accounts");
  });
});

describe("builder profile parsing and validation", () => {
  it("parses stored values and drops unknown platforms/tools", () => {
    expect(parseBuilderProfile({ platform: "wix", builderTools: ["chatgpt", "claude"] })).toEqual({ platform: "wix", builderTools: ["chatgpt", "claude"] });
    expect(parseBuilderProfile({ platform: "myspace", builderTools: ["chatgpt", "skynet", "chatgpt"] })).toEqual({ platform: null, builderTools: ["chatgpt"] });
    expect(parseBuilderProfile(null)).toEqual({ platform: null, builderTools: [] });
    expect(parseBuilderProfile([1, 2])).toEqual({ platform: null, builderTools: [] });
  });

  it("validates API selections strictly against the registry", () => {
    expect(isValidPlatformSelection(null)).toBe(true);
    expect(isValidPlatformSelection("squarespace")).toBe(true);
    expect(isValidPlatformSelection("myspace")).toBe(false);
    expect(isValidPlatformSelection(7)).toBe(false);
    expect(isValidBuilderToolSelection([])).toBe(true);
    expect(isValidBuilderToolSelection(["chatgpt", "perplexity"])).toBe(true);
    expect(isValidBuilderToolSelection(["chatgpt", "chatgpt"])).toBe(false);
    expect(isValidBuilderToolSelection(["skynet"])).toBe(false);
    expect(isValidBuilderToolSelection("chatgpt")).toBe(false);
  });
});
