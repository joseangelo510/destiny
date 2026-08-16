import { describe, expect, it } from "vitest";
import { nextOnboardingEmail, shouldSuppressOnboardingNudge, type OnboardingProgress } from "./onboarding";

const progress: OnboardingProgress = {
  accountCreatedAt: "2026-08-10T12:00:00Z",
  auditCompletedAt: null,
  approvedKeywordCount: 0,
  articleDraftCount: 0,
  integrationCount: 0,
  completedActionCount: 0,
  sentSteps: [],
};

describe("behavior-triggered onboarding email sequence", () => {
  it("starts with email one and one concrete CTA", () => {
    expect(nextOnboardingEmail(progress, new Date("2026-08-10T12:01:00Z"))).toMatchObject({ step: 1, ctaPath: "/onboarding", timeCostMinutes: 5 });
  });

  it("releases email two when audit data lands before the fallback", () => {
    expect(nextOnboardingEmail({ ...progress, auditCompletedAt: "2026-08-10T14:00:00Z", sentSteps: [1] }, new Date("2026-08-10T14:01:00Z"))).toMatchObject({ step: 2, trigger: "first audit data landed" });
  });

  it("uses a bounded fallback when behavior has not occurred", () => {
    expect(nextOnboardingEmail({ ...progress, sentSteps: [1] }, new Date("2026-08-11T12:01:00Z"))).toMatchObject({ step: 2, fallbackHours: 24 });
  });

  it("suppresses a completed behavior nudge", () => {
    expect(shouldSuppressOnboardingNudge(3, { ...progress, approvedKeywordCount: 5 })).toBe(true);
    expect(shouldSuppressOnboardingNudge(3, { ...progress, approvedKeywordCount: 4 })).toBe(false);
  });

  it("defines all six behavior steps without a seventh", () => {
    expect(nextOnboardingEmail({ ...progress, sentSteps: [1, 2, 3, 4, 5], completedActionCount: 1 }, new Date("2026-08-10T13:00:00Z"))).toMatchObject({ step: 6, ctaPath: "/this-week" });
    expect(nextOnboardingEmail({ ...progress, sentSteps: [1, 2, 3, 4, 5, 6] }, new Date("2026-08-20T13:00:00Z"))).toBeNull();
  });
});
