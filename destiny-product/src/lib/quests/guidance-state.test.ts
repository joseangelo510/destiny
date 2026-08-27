import { describe, expect, it } from "vitest";
import { guidancePresentation, isActionableGuidanceState, validateGuidanceStateInput } from "./guidance-state";

describe("guided task pauses", () => {
  it("keeps active work actionable and resurfaces due waiting work", () => {
    const now = new Date("2026-08-06T12:00:00.000Z");
    expect(isActionableGuidanceState("active", null, now)).toBe(true);
    expect(isActionableGuidanceState("waiting", "2026-08-05T12:00:00.000Z", now)).toBe(true);
    expect(isActionableGuidanceState("waiting", "2026-08-07T12:00:00.000Z", now)).toBe(false);
    expect(isActionableGuidanceState("blocked", null, now)).toBe(false);
  });

  it("requires a date for waiting and an owner plus reason for blockers", () => {
    expect(validateGuidanceStateInput({ guidanceState: "waiting" }).valid).toBe(false);
    expect(validateGuidanceStateInput({ guidanceState: "blocked", blockerReason: "CMS access", blockerOwner: "Site owner" }).valid).toBe(true);
    expect(validateGuidanceStateInput({ guidanceState: "active" })).toMatchObject({ valid: true, update: { guidance_state: "active", follow_up_at: null } });
  });

  it("labels waiting and blocked work without calling it complete", () => {
    expect(guidancePresentation({ guidance_state: "waiting", follow_up_at: "2026-08-27T02:30:00.000Z" })).toMatchObject({
      label: "Waiting",
      detail: "Resumes Aug 27, 2026.",
    });
    expect(guidancePresentation({ guidance_state: "blocked", blocker_reason: "Need approval", blocker_owner: "Client" })).toMatchObject({ label: "Blocked", tone: "blocked" });
  });
});
