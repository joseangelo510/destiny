import { describe, expect, it } from "vitest";
import {
  AUDIT_MOMENTUM_STAGES,
  ONBOARDING_MOMENTUM_STAGES,
  auditMomentumJourney,
  onboardingMomentumJourney,
} from "./momentum-journey";

describe("Destiny momentum journey", () => {
  it("keeps the three required onboarding sections while making progress explicit", async () => {
    expect(ONBOARDING_MOMENTUM_STAGES.map((stage) => stage.title)).toEqual([
      "Business & website",
      "Customer & market",
      "Competitors & edge",
    ]);

    const journey = await onboardingMomentumJourney(3);
    expect(journey.current.title).toBe("Competitors & edge");
    expect(journey.completedCount).toBe(2);
    expect(journey.percent).toBe(67);
    expect(journey.stages.map((stage) => stage.state)).toEqual([
      "complete",
      "complete",
      "active",
    ]);
  });

  it("maps only saved audit progress to completed research stages", async () => {
    expect(AUDIT_MOMENTUM_STAGES.map((stage) => stage.completeAt)).toEqual([10, 30, 45, 65, 80, 100]);

    const journey = await auditMomentumJourney(65, "running");
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

  it("does not claim the strategy is ready before the audit is actually complete", async () => {
    const stillRunning = await auditMomentumJourney(99, "running");
    expect(stillRunning.completedCount).toBe(5);
    expect(stillRunning.current.id).toBe("coaching-route");
    expect(stillRunning.ready).toBe(false);

    const complete = await auditMomentumJourney(100, "complete");
    expect(complete.completedCount).toBe(6);
    expect(complete.ready).toBe(true);
    expect(complete.current.id).toBe("coaching-route");
  });

  it("clamps malformed progress and marks only the active stage as failed", async () => {
    expect((await auditMomentumJourney(-40, "running")).percent).toBe(0);
    expect((await auditMomentumJourney(900, "complete")).percent).toBe(100);

    const failed = await auditMomentumJourney(46, "failed");
    expect(failed.current.id).toBe("competitor-map");
    expect(failed.stages.find((stage) => stage.id === "competitor-map")?.state).toBe("failed");
    expect(failed.stages.filter((stage) => stage.state === "complete")).toHaveLength(3);
  });
});
