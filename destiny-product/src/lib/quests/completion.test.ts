import { describe, expect, it } from "vitest";
import { buildQuestCompletionUpdate } from "./completion";

describe("truthful quest completion", () => {
  const now = "2026-08-01T20:00:00.000Z";

  it("verifies an explicit business-understanding confirmation", () => {
    expect(buildQuestCompletionUpdate("business_confirmation", "complete", now)).toEqual({
      status: "complete",
      completed_at: now,
      verification_status: "verified",
      verified_at: now,
      verification_method: "user_confirmation",
    });
  });

  it("labels ordinary self-reported work as unverified", () => {
    expect(buildQuestCompletionUpdate("primary_quest", "complete", now)).toEqual({
      status: "complete",
      completed_at: now,
      verification_status: "unverified",
      verified_at: null,
      verification_method: null,
    });
  });

  it("clears completion evidence when a task is reopened", () => {
    expect(buildQuestCompletionUpdate("business_confirmation", "todo", now)).toEqual({
      status: "todo",
      completed_at: null,
      verification_status: "unverified",
      verified_at: null,
      verification_method: null,
    });
  });
});
