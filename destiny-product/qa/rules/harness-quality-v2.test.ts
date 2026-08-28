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

  it("fails changed functions above an absolute complexity ceiling", async () => {
    const { evaluateChangedFunctionComplexity } = await loadQualityModule();
    expect(evaluateChangedFunctionComplexity([
      {
        filePath: "/repo/src/lib/clean.ts",
        messages: [{ ruleId: "complexity", line: 4, message: "Function 'clean' has a complexity of 8. Maximum allowed is 0." }],
      },
      {
        filePath: "/repo/scripts/harness/risky.mjs",
        messages: [
          { ruleId: "complexity", line: 9, message: "Async function 'risky' has a complexity of 23. Maximum allowed is 0." },
          { ruleId: "other", line: 1, message: "not a complexity measurement" },
        ],
      },
    ], { productRoot: "/repo", maximum: 20 })).toEqual({
      maximum: 23,
      offenders: [{ complexity: 23, file: "scripts/harness/risky.mjs", line: 9 }],
    });
    expect(() => evaluateChangedFunctionComplexity([
      { filePath: "/repo/src/lib/a.ts", messages: [{ ruleId: "complexity", line: 1, message: "malformed" }] },
    ], { productRoot: "/repo", maximum: 20 })).toThrow("Malformed ESLint complexity measurement");
  });

  it("treats route inventory and journey proof as separate denominators", async () => {
    const { calculateRouteJourneyCoverage } = await loadQualityModule();
    expect(calculateRouteJourneyCoverage(
      ["/", "/app", "/keywords", "/api/version"],
      ["/", "/app", "/api/version"],
    )).toEqual({ covered: 3, percentage: 75, total: 4, uncovered: ["/keywords"] });
  });

  it("requires contract or journey proof for every touched route", async () => {
    const { validateTouchedRouteCoverage } = await loadQualityModule();
    expect(validateTouchedRouteCoverage(
      ["/api/version", "/app"],
      { apiRoutes: new Set(["/api/version"]), browserRoutes: new Set(["/app"]) },
    )).toEqual([]);
    expect(validateTouchedRouteCoverage(
      ["/api/audits", "/onboarding", "/unknown"],
      { apiRoutes: new Set(["/api/version"]), browserRoutes: new Set(["/"]), knownRoutes: new Set(["/api/audits", "/onboarding"]) },
    )).toEqual([
      "Touched API route lacks a contract test: /api/audits.",
      "Touched browser route lacks a source-backed journey: /onboarding.",
      "Touched route is absent from inventory: /unknown.",
    ]);
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

  it("measures typed browser journeys and API route contracts separately", async () => {
    const { calculateTypedJourneyCoverage, validateJourneyRegistry } = await loadQualityModule();
    const registry = {
      schemaVersion: "2.0.0",
      journeys: [{
        id: "public-home",
        mode: "public",
        owner: "quality",
        testFile: "qa/e2e/public.spec.ts",
        routes: ["/"],
        assertions: ["document", "accessibility"],
        routeEvidence: { "/": "page.goto(\"/\")" },
        assertionEvidence: { document: "toHaveTitle", accessibility: "AxeBuilder" },
      }],
    };
    expect(validateJourneyRegistry(registry, {
      knownRoutes: new Set(["/", "/app", "/api/version"]),
      testFiles: new Set(["qa/e2e/public.spec.ts"]),
      testSources: new Map([["qa/e2e/public.spec.ts", 'page.goto("/"); toHaveTitle(); AxeBuilder();']]),
    })).toEqual([]);
    expect(calculateTypedJourneyCoverage(
      ["/", "/app", "/api/version"],
      registry.journeys,
      ["/api/version"],
    )).toEqual({
      apiContractCoverage: 100,
      browserJourneyCoverage: 50,
      routeJourneyCoverage: 66.67,
      details: {
        api: { covered: 1, total: 1, uncovered: [] },
        browser: { covered: 1, total: 2, uncovered: ["/app"] },
        combined: { covered: 2, total: 3, uncovered: ["/app"] },
      },
    });
  });

  it("rejects journey route or assertion claims without source evidence", async () => {
    const { validateJourneyRegistry } = await loadQualityModule();
    const testFile = "qa/e2e/public.spec.ts";
    const errors = validateJourneyRegistry({
      schemaVersion: "2.0.0",
      journeys: [{
        id: "public-home",
        mode: "public",
        owner: "quality",
        testFile,
        routes: ["/", "/app"],
        assertions: ["document", "accessibility"],
        routeEvidence: { "/": "page.goto(\"/\")", "/app": "page.goto(\"/app\")", "/extra": "fabricated" },
        assertionEvidence: { document: "toHaveTitle", accessibility: "AxeBuilder", fabricated: "never" },
      }],
    }, {
      knownRoutes: new Set(["/", "/app"]),
      testFiles: new Set([testFile]),
      testSources: new Map([[testFile, 'page.goto("/"); toHaveTitle();']]),
    });
    expect(errors).toEqual(expect.arrayContaining([
      "Journey public-home route evidence is not present in qa/e2e/public.spec.ts: /app.",
      "Journey public-home assertion evidence is not present in qa/e2e/public.spec.ts: accessibility.",
      "Journey public-home has undeclared route evidence: /extra.",
      "Journey public-home has undeclared assertion evidence: fabricated.",
    ]));
  });

  it("rejects unowned, missing-test, duplicate, and unknown-route journeys", async () => {
    const { validateJourneyRegistry } = await loadQualityModule();
    expect(validateJourneyRegistry({
      schemaVersion: "1.0.0",
      journeys: [
        { id: "same", mode: "live", testFile: "missing.spec.ts", routes: ["/unknown"], assertions: [] },
        { id: "same", mode: "public", owner: "quality", testFile: "qa/e2e/public.spec.ts", routes: ["/"], assertions: ["document"] },
      ],
    }, { knownRoutes: new Set(["/"]), testFiles: new Set(["qa/e2e/public.spec.ts"]) })).toEqual(expect.arrayContaining([
      "Journey registry schemaVersion must be 2.0.0.",
      "Journey same has an invalid mode.",
      "Journey same requires an owner.",
      "Journey same test file does not exist: missing.spec.ts.",
      "Journey same references unknown route /unknown.",
      "Journey same requires assertions.",
      "Journey ID is duplicated: same.",
    ]));
  });

  it("mutates only files whose emitted JavaScript changed", async () => {
    const { filterExecutableChanges } = await loadQualityModule();
    expect(filterExecutableChanges([
      "src/lib/types.ts",
      "src/lib/logic.ts",
      "src/lib/same.ts",
    ], {
      baseOutputs: new Map([
        ["src/lib/logic.ts", "export const value = 1;"],
        ["src/lib/same.ts", "export const same = true;"],
      ]),
      headOutputs: new Map([
        ["src/lib/types.ts", "export {};"],
        ["src/lib/logic.ts", "export const value = 2;"],
        ["src/lib/same.ts", "export const same = true;"],
      ]),
    })).toEqual(["src/lib/logic.ts"]);
  });

  it("counts executable skip calls without counting test fixture strings", async () => {
    const { countSkippedTests } = await loadQualityModule();
    const executableSkip = "test" + ".skip";
    const skipCall = `${executableSkip}(`;
    expect(countSkippedTests(`
      ${executableSkip}("real debt", () => {});
      const fixture = "+${skipCall}'text only', () => {})";
      // ${skipCall}"comment only", () => {});
    `)).toBe(1);
  });
});
