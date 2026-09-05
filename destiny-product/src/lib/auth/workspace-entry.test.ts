import { describe, expect, it } from "vitest";
import { onboardingEntryDestination } from "./workspace-entry";

describe("onboardingEntryDestination", () => {
  it("requires a permanent session before onboarding", () => {
    expect(onboardingEntryDestination({ authenticated: false, hasWebsite: false }))
      .toBe("/login?next=%2Fonboarding");
  });

  it("restores a returning user's populated workspace", () => {
    expect(onboardingEntryDestination({ authenticated: true, hasWebsite: true }))
      .toBe("/app");
  });

  it("lets a signed-in first-time user complete onboarding", () => {
    expect(onboardingEntryDestination({ authenticated: true, hasWebsite: false }))
      .toBeNull();
  });

  it("lets a returning user explicitly start another website", () => {
    expect(onboardingEntryDestination({ authenticated: true, hasWebsite: true, startNew: true }))
      .toBeNull();
  });
});
