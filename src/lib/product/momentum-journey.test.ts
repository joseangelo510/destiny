import { describe, expect, it } from "vitest";
import {
  AUDIT_MOMENTUM_STAGES,
  ONBOARDING_MOMENTUM_STAGES,
  auditMomentumJourney,
  onboardingMomentumJourney,
} from "./momentum-journey";

describe("Destiny momentum journey", () => {
  it("keeps the existing four onboarding sections while making progress explicit", () => {
    expect(ONBOARDING_MOMENTUM_STAGES.map((stage) => stage.title)).toEqual([
      "Business & website",
      "Customer & market",
      "Competitors & edge",
      "Review & analyze",
    ]);

    const journey = onboardingMomentumJourney(3);
    expect(journey.current.title).toBe("Competitors & edge");
    expect(journey.completedCount).toBe(2);
    expect(journey.percent).toBe(50);
    expect(journey.stages.map((stage) => stage.state)).toEqual([
      "complete",
      "complete",
      "active",
      "upcoming",
    ]);
  });

  it("maps only saved audit progress to completed research stages", () => {
    expect(AUDIT_MOMENTUM_STAGES.map((stage) => stage.completeAt)).toEqual([10, 30, 45, 65, 80, 100]);

    const journey = auditMomentumJourney(65, "running");
    expect(journey.completedCount).toBe(4);
    expect(journey.current.id).toBe("revenue-keywords");
    expect(journey.stages.map((stage) => stage.state)).toEqual([
      "complete",
      "complete",
      "complete",
      "complete",
      "active",
      "upcoming",
    ]);
    expect(journey.statusLine).toContain("65%");
  });

  it("does not claim the strategy is ready before the audit is actually complete", () => {
    const stillRunning = auditMomentumJourney(99, "running");
    expect(stillRunning.completedCount).toBe(5);
    expect(stillRunning.current.id).toBe("coaching-route");
    expect(stillRunning.ready).toBe(false);

    const complete = auditMomentumJourney(100, "complete");
    expect(complete.completedCount).toBe(6);
    expect(complete.ready).toBe(true);
    expect(complete.current.id).toBe("coaching-route");
  });

  it("clamps malformed progress and marks only the active stage as failed", () => {
    expect(auditMomentumJourney(-40, "running").percent).toBe(0);
    expect(auditMomentumJourney(900, "complete").percent).toBe(100);

    const failed = auditMomentumJourney(46, "failed");
    expect(failed.current.id).toBe("competitor-map");
    expect(failed.stages.find((stage) => stage.id === "competitor-map")?.state).toBe("failed");
    expect(failed.stages.filter((stage) => stage.state === "complete")).toHaveLength(3);
  });
});
