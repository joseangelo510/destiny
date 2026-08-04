import { describe, expect, it } from "vitest";
import { buildQuestCompletionUpdate, isStreakActionableTask, questTransitionInput } from "./completion";

const policy = (overrides: Record<string, unknown> = {}) => ({
  questTransitionAllowed: true,
  questTransitionRuleId: "allow_complete",
  questVerificationStatus: "unverified",
  questSetCompletedAt: true,
  questSetVerifiedAt: false,
  questClearEvidence: false,
  questCelebration: "task_complete",
  ...overrides,
});

describe("LOGOS quest completion adapter", () => {
  const now = "2026-08-01T20:00:00.000Z";

  it("marshals raw task and status codes without deciding the transition", () => {
    expect(questTransitionInput({ currentStatus: "todo", requestedStatus: "complete", taskType: "business_confirmation", remainingAfterCompletion: -1 })).toEqual({
      questTaskCode: 1,
      questCurrentStatusCode: 0,
      questRequestedStatusCode: 1,
      questRemainingAfterCompletion: -1,
    });
  });

  it("materializes LOGOS verification and timestamp flags", () => {
    expect(buildQuestCompletionUpdate("complete", now, policy({ questVerificationStatus: "verified", questSetVerifiedAt: true }) as never)).toEqual({
      status: "complete",
      completed_at: now,
      verification_status: "verified",
      verified_at: now,
      verification_method: "user_confirmation",
    });
  });

  it("clears stored evidence when LOGOS reopens a task", () => {
    expect(buildQuestCompletionUpdate("todo", now, policy({ questTransitionRuleId: "allow_reopen", questSetCompletedAt: false, questSetVerifiedAt: false, questClearEvidence: true }) as never)).toEqual({
      status: "todo",
      completed_at: null,
      verification_status: "unverified",
      verified_at: null,
      verification_method: null,
    });
  });

  it("rejects a transition LOGOS disallows", () => {
    expect(() => buildQuestCompletionUpdate("skipped", now, policy({ questTransitionAllowed: false, questTransitionRuleId: "reject_required_task_skip" }) as never)).toThrow("reject_required_task_skip");
  });

  it("keeps non-coaching confirmation tasks outside streak inputs", () => {
    expect(isStreakActionableTask("business_confirmation")).toBe(false);
    expect(isStreakActionableTask("vocabulary_review")).toBe(false);
    expect(isStreakActionableTask("primary_quest")).toBe(true);
  });
});
