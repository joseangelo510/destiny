import { describe, expect, it } from "vitest";
import { googleAnalyticsSelectionState } from "./google-analytics-selection";

describe("Google Analytics snapshot ownership", () => {
  it("accepts metrics only when the saved property proves the selected website domain", () => {
    const metadata = {
      selectedProperty: { property: "properties/222", displayName: "Example GA4", matchesWebsite: true, matchedDomain: "example.com" },
      organicSessions: 12,
    };

    expect(googleAnalyticsSelectionState(metadata, "example.com")).toEqual({
      metadata,
      selectedResource: "Example GA4 · properties/222",
      status: "verified",
      message: "Google Analytics is verified for example.com.",
    });
  });

  it("suppresses legacy or cross-site snapshots until the property is verified", () => {
    const legacy = googleAnalyticsSelectionState({
      selectedProperty: { property: "properties/111", displayName: "Other brand" },
      organicSessions: 900,
    }, "example.com");
    const mismatched = googleAnalyticsSelectionState({
      selectedProperty: { property: "properties/222", matchesWebsite: true, matchedDomain: "other.example" },
      organicSessions: 12,
    }, "example.com");

    expect(legacy.metadata).toBeNull();
    expect(legacy.status).toBe("unverified");
    expect(legacy.message).toContain("verify");
    expect(mismatched.metadata).toBeNull();
    expect(mismatched.status).toBe("unverified");
  });

  it("keeps selection-required discovery out of analytics totals", () => {
    const state = googleAnalyticsSelectionState({ selectionRequired: true, organicSessions: 900 }, "example.com");

    expect(state.metadata).toBeNull();
    expect(state.status).toBe("selection_required");
    expect(state.message).toBe("Choose a Google Analytics property verified for example.com.");
  });
});
