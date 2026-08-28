import { describe, expect, it } from "vitest";
async function loadRatchetModule() {
  const modulePath = "../../scripts/harness/" + "ratchet.mjs";
  return import(/* @vite-ignore */ modulePath);
}

describe("measured quality ratchets", () => {
  const baseline = {
    architectureViolations: 2,
    changedBranchCoverage: 72,
    changedLineCoverage: 80,
    changedMutationScore: 65,
    duplicateBlocks: 4,
    flakyRetries: 0,
    quarantinedTests: 0,
    skippedTests: 0,
    testCount: 1000,
  };

  it("allows debt to hold or improve and rejects regressions", async () => {
    const { compareRatchetMetrics } = await loadRatchetModule();
    expect(compareRatchetMetrics(baseline, {
      ...baseline,
      architectureViolations: 1,
      changedLineCoverage: 82,
      testCount: 900,
    })).toEqual([]);
    expect(compareRatchetMetrics(baseline, {
      ...baseline,
      architectureViolations: 3,
      changedBranchCoverage: 71,
      testCount: 1200,
    })).toEqual([
      "architectureViolations worsened from 2 to 3.",
      "changedBranchCoverage worsened from 72 to 71.",
    ]);
  });

  it("does not treat raw test count or duration as improve-only quality signals", async () => {
    const { compareRatchetMetrics } = await loadRatchetModule();
    expect(compareRatchetMetrics(baseline, { ...baseline, testCount: 1 })).toEqual([]);
    expect(compareRatchetMetrics(baseline, { ...baseline, prLaneSeconds: 100 }, {
      ceilings: { prLaneSeconds: 120 },
    })).toEqual([]);
    expect(compareRatchetMetrics(baseline, { ...baseline, prLaneSeconds: 121 }, {
      ceilings: { prLaneSeconds: 120 },
    })).toContain("prLaneSeconds exceeded its 120 ceiling with 121.");
  });

  it("requires an owner, expiry, decision, and reason for temporary regression", async () => {
    const { validateRatchetException } = await loadRatchetModule();
    expect(validateRatchetException({
      decisionId: "D-HARNESS-EXCEPTION-1",
      owner: "joseangelo510",
      reason: "Temporary migration window",
      expiresAt: "2026-09-01T00:00:00Z",
    }, new Date("2026-08-27T00:00:00Z"))).toEqual([]);
    expect(validateRatchetException({ owner: "joseangelo510" }, new Date("2026-08-27T00:00:00Z")))
      .toEqual(expect.arrayContaining([
        "Ratchet exception requires a Fable High decision ID.",
        "Ratchet exception requires an expiry.",
      ]));
  });
});
