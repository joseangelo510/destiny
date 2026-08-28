import { readFile } from "node:fs/promises";
import path from "node:path";
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
    expect(compareRatchetMetrics({ changedLineCoverage: 80 }, {
      changedLineCoverage: 80,
      prLaneSeconds: 120,
    }, { ceilings: { prLaneSeconds: 120 } })).toEqual([]);
    expect(compareRatchetMetrics({ changedLineCoverage: 80 }, {})).toEqual([]);
    expect(compareRatchetMetrics({ changedLineCoverage: Number.NaN }, { changedLineCoverage: 1 })).toEqual([]);
    expect(compareRatchetMetrics({ changedLineCoverage: 80 }, { changedLineCoverage: Number.POSITIVE_INFINITY })).toEqual([]);
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

  it("ratchets every declared quality direction", async () => {
    const { compareRatchetMetrics } = await loadRatchetModule();
    expect(compareRatchetMetrics({
      architectureViolations: 0, auditExceptions: 1, changedMaximumFunctionComplexity: 2, dependencyCycles: 1, duplicateBlocks: 1,
      duplicationPercentage: 1, eslintWarnings: 0, flakyRetries: 0, maximumCyclomaticComplexity: 2,
      quarantinedTests: 0, skippedTests: 0, typeErrors: 0, changedBranchCoverage: 80,
      changedLineCoverage: 80, changedMutationScore: 70, apiContractCoverage: 80,
      browserJourneyCoverage: 80, routeJourneyCoverage: 50, testCount: 500,
    }, {
      architectureViolations: 1, auditExceptions: 2, changedMaximumFunctionComplexity: 3, dependencyCycles: 2, duplicateBlocks: 2,
      duplicationPercentage: 2, eslintWarnings: 1, flakyRetries: 1, maximumCyclomaticComplexity: 3,
      quarantinedTests: 1, skippedTests: 1, typeErrors: 1, changedBranchCoverage: 79,
      changedLineCoverage: 79, changedMutationScore: 69, apiContractCoverage: 79,
      browserJourneyCoverage: 79, routeJourneyCoverage: 49, testCount: 1,
    })).toHaveLength(18);
  });

  it("rejects malformed and expired exceptions", async () => {
    const { validateRatchetException } = await loadRatchetModule();
    const now = new Date("2026-08-27T00:00:00Z");
    expect(validateRatchetException({ decisionId: "no", expiresAt: "later" }, now)).toEqual(expect.arrayContaining([
      "Ratchet exception requires a Fable High decision ID.", "Ratchet exception requires an owner.",
      "Ratchet exception requires a reason.", "Ratchet exception expiry is invalid.",
    ]));
    expect(validateRatchetException({ decisionId: "D-VALID-1", owner: "joseangelo510", reason: "bounded", expiresAt: "2026-08-26T00:00:00Z" }, now))
      .toContain("Ratchet exception has expired.");
    expect(validateRatchetException({ decisionId: "xD-VALID-1", owner: "owner", reason: "bounded", expiresAt: "2026-09-01T00:00:00Z" }, now))
      .toContain("Ratchet exception requires a Fable High decision ID.");
    expect(validateRatchetException({ decisionId: "D-VALID-1x!", owner: "owner", reason: "bounded", expiresAt: "2026-09-01T00:00:00Z" }, now))
      .toContain("Ratchet exception requires a Fable High decision ID.");
    expect(validateRatchetException({ decisionId: "D-VALID-1", owner: "owner", reason: "bounded", expiresAt: now.toISOString() }, now))
      .toContain("Ratchet exception has expired.");
    expect(validateRatchetException(null, now)).toEqual([
      "Ratchet exception requires a Fable High decision ID.",
      "Ratchet exception requires an owner.",
      "Ratchet exception requires a reason.",
      "Ratchet exception requires an expiry.",
    ]);
  });

  it("skips absent and non-numeric metrics without weakening directional ratchets", async () => {
    const { compareRatchetMetrics } = await loadRatchetModule();
    expect(compareRatchetMetrics({ changedLineCoverage: "80" }, { changedLineCoverage: 79 })).toEqual([]);
    expect(compareRatchetMetrics({ changedLineCoverage: 80 }, { changedLineCoverage: "79" })).toEqual([]);
    expect(compareRatchetMetrics({ testCount: 10, changedLineCoverage: 80 }, { testCount: 1 })).toEqual([]);

    const source = await readFile(path.join(process.cwd(), "scripts/harness/ratchet.mjs"), "utf8");
    expect(source).toContain("redundant informational guard is intentionally absent");
    expect(source).toContain("ANSI grammar is exhaustively specified");
    expect(source).toContain("build stage ordering is exhaustively specified");
    expect(source).toContain("invalid sentinels cannot satisfy their validators");
    expect(source).toContain("invalid policy output cannot emit recognized warnings");
  });

  it("locks newly demonstrated mutation and route-proof floors", async () => {
    const baseline = JSON.parse(await readFile(path.join(process.cwd(), "qa/harness/baseline.v2.json"), "utf8"));
    const stryker = await readFile(path.join(process.cwd(), "stryker.config.mjs"), "utf8");
    expect(baseline.metrics).toEqual(expect.objectContaining({
      apiContractCoverage: 100,
      browserJourneyCoverage: 100,
      changedBranchCoverage: 100,
      changedLineCoverage: 100,
      changedMutationScore: 69,
      duplicationPercentage: 3.01,
      routeJourneyCoverage: 100,
    }));
    expect(baseline.ratchetHistory).toEqual(expect.arrayContaining([
      expect.objectContaining({ metric: "changedMutationScore", from: 60, to: 68 }),
      expect.objectContaining({ metric: "changedBranchCoverage", from: 45.59, to: 84 }),
      expect.objectContaining({ metric: "changedLineCoverage", from: 56.45, to: 90 }),
      expect.objectContaining({ metric: "apiContractCoverage", from: 42.86, to: 53.06 }),
      expect.objectContaining({ metric: "routeJourneyCoverage", from: 48.72, to: 55.13 }),
      expect.objectContaining({ metric: "apiContractCoverage", from: 53.06, to: 65.31 }),
      expect.objectContaining({ metric: "routeJourneyCoverage", from: 55.13, to: 62.82 }),
      expect.objectContaining({ metric: "apiContractCoverage", from: 65.31, to: 100 }),
      expect.objectContaining({ metric: "routeJourneyCoverage", from: 62.82, to: 84.62 }),
      expect.objectContaining({ metric: "duplicationPercentage", from: 3.04, to: 3.01 }),
      expect.objectContaining({ metric: "browserJourneyCoverage", from: 58.62, to: 65.52 }),
      expect.objectContaining({ metric: "routeJourneyCoverage", from: 84.62, to: 87.18 }),
      expect.objectContaining({ metric: "changedBranchCoverage", from: 84, to: 89 }),
      expect.objectContaining({ metric: "changedLineCoverage", from: 90, to: 91 }),
      expect.objectContaining({ metric: "changedMutationScore", from: 68, to: 69 }),
      expect.objectContaining({ metric: "browserJourneyCoverage", from: 65.52, to: 100 }),
      expect.objectContaining({ metric: "routeJourneyCoverage", from: 87.18, to: 100 }),
      expect.objectContaining({ metric: "changedBranchCoverage", from: 89, to: 91 }),
      expect.objectContaining({ metric: "changedLineCoverage", from: 91, to: 100 }),
      expect.objectContaining({ metric: "changedBranchCoverage", from: 91, to: 100 }),
    ]));
    expect(stryker).toMatch(/low:\s*69/);
    expect(stryker).toMatch(/break:\s*69/);
    expect(stryker).toMatch(/ignoreStatic:\s*false/);
  });
});
