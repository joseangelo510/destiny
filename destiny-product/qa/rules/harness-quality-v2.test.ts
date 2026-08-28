import { describe, expect, it } from "vitest";

async function loadQualityModule() {
  const modulePath = "../../scripts/harness/" + "quality.mjs";
  return import(/* @vite-ignore */ modulePath);
}

async function loadRepositoryModule() {
  const modulePath = "../../scripts/harness/" + "repository.mjs";
  return import(/* @vite-ignore */ modulePath);
}

describe("changed-scope quality measurement", () => {
  it("computes changed-line coverage without rewarding unexecuted files", async () => {
    const { calculateChangedCoverage } = await loadQualityModule();
    expect(calculateChangedCoverage({
      changedLines: new Map([
        ["src/lib/a.ts", new Set([2, 3, 4])],
        ["src/lib/b.ts", new Set([1])],
      ]),
      coverage: {
        "src/lib/a.ts": { lines: { 2: 1, 3: 0, 4: 2 }, branches: { 3: [1, 0] } },
      },
    })).toEqual({ branchCoverage: 50, coveredBranches: 1, coveredLines: 2, lineCoverage: 50, totalBranches: 2, totalLines: 4 });
  });

  it("fails closed when mutation scope exceeds its measured cap", async () => {
    const { selectMutationTargets } = await loadQualityModule();
    expect(selectMutationTargets([
      "src/lib/seo/a.ts",
      "src/components/a.tsx",
      "scripts/harness/rule.mjs",
      "README.md",
    ], { maximumFiles: 3 })).toEqual([
      "scripts/harness/rule.mjs",
      "src/components/a.tsx",
      "src/lib/seo/a.ts",
    ]);
    expect(() => selectMutationTargets([
      "src/lib/a.ts",
      "src/lib/b.ts",
      "src/lib/c.ts",
    ], { maximumFiles: 2 })).toThrow("Changed mutation scope has 3 files; cap is 2");
  });

  it("measures structural debt deterministically", async () => {
    const { measureSourceDebt } = await loadQualityModule();
    const result = measureSourceDebt(new Map([
      ["src/lib/a.ts", "export function a(value: boolean) { if (value) return 1; return 0; }"],
      ["src/lib/b.ts", "export function b(value: boolean) { if (value) return 1; return 0; }"],
    ]), { duplicateTokenFloor: 8 });
    expect(result.duplicateBlocks).toBeGreaterThan(0);
    expect(result.maximumCyclomaticComplexity).toBe(2);
  });

  it("treats route inventory and journey proof as separate denominators", async () => {
    const { calculateRouteJourneyCoverage } = await loadQualityModule();
    expect(calculateRouteJourneyCoverage(
      ["/", "/app", "/keywords", "/api/version"],
      ["/", "/app", "/api/version"],
    )).toEqual({ covered: 3, percentage: 75, total: 4, uncovered: ["/keywords"] });
  });

  it("handles empty coverage and deduplicates normalized mutation targets", async () => {
    const { calculateChangedCoverage, selectMutationTargets } = await loadQualityModule();
    expect(calculateChangedCoverage({ changedLines: new Map(), coverage: {} })).toEqual({
      branchCoverage: 100, coveredBranches: 0, coveredLines: 0, lineCoverage: 100, totalBranches: 0, totalLines: 0,
    });
    expect(selectMutationTargets([
      "src\\lib\\a.ts", "src/lib/a.ts", "src/lib/a.test.ts", "scripts/other.mjs", "scripts/harness/a.mjs",
    ], { maximumFiles: 2 })).toEqual(["scripts/harness/a.mjs", "src/lib/a.ts"]);
  });

  it("deduplicates route inventory and handles an empty route set", async () => {
    const { calculateRouteJourneyCoverage } = await loadQualityModule();
    expect(calculateRouteJourneyCoverage(["/a", "/a"], ["/a"])).toEqual({ covered: 1, percentage: 100, total: 1, uncovered: [] });
    expect(calculateRouteJourneyCoverage([], [])).toEqual({ covered: 0, percentage: 100, total: 0, uncovered: [] });
  });

  it("centralizes protected-main resolution and fail-closes without a canonical ref", async () => {
    const { resolveProtectedMainRef } = await loadRepositoryModule();
    expect(resolveProtectedMainRef({ override: "base", refExists: () => false })).toBe("base");
    expect(resolveProtectedMainRef({ refExists: (ref: string) => ref === "github/main" })).toBe("github/main");
    expect(() => resolveProtectedMainRef({ refExists: () => false, purpose: "Mutation" }))
      .toThrow("Mutation requires a canonical protected-main ref.");
  });
});
