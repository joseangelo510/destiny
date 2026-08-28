import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

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
    expect(measureSourceDebt(new Map([
      ["src/lib/plain.ts", "   "],
    ]), { duplicateTokenFloor: 8 })).toEqual({ duplicateBlocks: 0, maximumCyclomaticComplexity: 1 });
    expect(measureSourceDebt(new Map())).toEqual({ duplicateBlocks: 0, maximumCyclomaticComplexity: 0 });
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
    expect(evaluateChangedFunctionComplexity([
      { messages: [] },
      { filePath: "/external/file.ts" },
    ], { productRoot: "/repo/", maximum: 20 })).toEqual({ maximum: 0, offenders: [] });
    expect(evaluateChangedFunctionComplexity([
      { filePath: "/repo/src/lib/no-line.ts", messages: [{ ruleId: "complexity", message: "Function has a complexity of 1." }] },
    ], { productRoot: "/repo", maximum: 20 })).toEqual({
      maximum: 1,
      offenders: [],
    });
    expect(() => evaluateChangedFunctionComplexity([
      { messages: [{ ruleId: "complexity" }] },
    ], { productRoot: "/repo", maximum: 20 })).toThrow("Malformed ESLint complexity measurement for :0");
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
    const { git, protectedMainRef, resolveProtectedMainRef } = await loadRepositoryModule();
    expect(resolveProtectedMainRef({ override: "base", refExists: () => false })).toBe("base");
    expect(resolveProtectedMainRef({ refExists: (ref: string) => ref === "github/main" })).toBe("github/main");
    expect(() => resolveProtectedMainRef({ refExists: () => false, purpose: "Mutation" }))
      .toThrow("Mutation requires a canonical protected-main ref.");
    expect(() => resolveProtectedMainRef({ refExists: () => false }))
      .toThrow("Harness requires a canonical protected-main ref.");
    expect(git(process.cwd(), ["rev-parse", "--is-inside-work-tree"])).toBe("true");
    expect(protectedMainRef({ repositoryRoot: process.cwd(), purpose: "Coverage" })).toBe("origin/main");
    const emptyRepository = await mkdtemp(path.join(tmpdir(), "destiny-no-main-"));
    try {
      expect(() => protectedMainRef({ repositoryRoot: emptyRepository, purpose: "Coverage" }))
        .toThrow("Coverage requires a canonical protected-main ref.");
    } finally {
      await rm(emptyRepository, { recursive: true, force: true });
    }
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

  it("fails closed for malformed registries and completely missing journey evidence", async () => {
    const { validateJourneyRegistry } = await loadQualityModule();
    expect(validateJourneyRegistry(null)).toEqual(["Journey registry must be an object."]);
    expect(validateJourneyRegistry([])).toEqual(["Journey registry must be an object."]);
    expect(validateJourneyRegistry({ schemaVersion: "2.0.0", journeys: [] })).toEqual([
      "Journey registry requires at least one journey.",
    ]);
    const errors = validateJourneyRegistry({
      schemaVersion: "2.0.0",
      journeys: [{ routes: ["/"], assertions: ["document"], routeEvidence: {}, assertionEvidence: {} }],
    }, { knownRoutes: new Set(["/"]) });
    expect(errors).toEqual(expect.arrayContaining([
      "Journey <missing> has an invalid mode.",
      "Journey <missing> requires an owner.",
      "Journey <missing> test file does not exist: <missing>.",
      "Journey <missing> requires route evidence: /.",
      "Journey <missing> requires assertion evidence: document.",
    ]));
    expect(validateJourneyRegistry({
      schemaVersion: "2.0.0",
      journeys: [{ id: "empty", mode: "public", owner: "quality", testFile: "empty.spec.ts", routes: [], assertions: [] }],
    }, { testFiles: new Set(["empty.spec.ts"]) })).toEqual(expect.arrayContaining([
      "Journey empty requires routes.",
      "Journey empty requires assertions.",
    ]));
    expect(validateJourneyRegistry({
      schemaVersion: "2.0.0",
      journeys: [{ id: "absent", mode: "public", owner: "quality", testFile: "empty.spec.ts" }],
    }, { testFiles: new Set(["empty.spec.ts"]) })).toEqual(expect.arrayContaining([
      "Journey absent requires routes.",
      "Journey absent requires assertions.",
    ]));
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
    expect(countSkippedTests("test('clean', () => {})")).toBe(0);
  });

  it("exhausts coverage counters and mutation-target path boundaries", async () => {
    const { calculateChangedCoverage, selectMutationTargets } = await loadQualityModule();
    expect(calculateChangedCoverage({
      changedLines: new Map([["src/a.ts", new Set([1])]]),
      coverage: { "src/a.ts": {} },
    })).toEqual({ branchCoverage: 100, coveredBranches: 0, coveredLines: 0, lineCoverage: 0, totalBranches: 0, totalLines: 1 });
    expect(calculateChangedCoverage({
      changedLines: new Map([["src/a.ts", new Set([1, 2])]]),
      coverage: { "src/a.ts": { lines: { 1: -1, 2: 0 }, branches: { 1: [1, 1] } } },
    })).toEqual({ branchCoverage: 100, coveredBranches: 2, coveredLines: 0, lineCoverage: 0, totalBranches: 2, totalLines: 2 });
    expect(selectMutationTargets(["src\\lib\\only.ts"], { maximumFiles: 1 })).toEqual(["src/lib/only.ts"]);
    expect(selectMutationTargets([
      "src/a.ts.extra",
      "src/a.test.ts.extra",
      "src/a.test.cts",
      "src/a.spec.mjs",
      "src/real.cts",
      "src/real.mts",
    ], { maximumFiles: 2 })).toEqual(["src/real.cts", "src/real.mts"]);
  });

  it("exhausts structural-debt token windows and maximum selection", async () => {
    const { measureSourceDebt } = await loadQualityModule();
    const exactWindow = "alpha_1 = 123.45 && beta$ !== 9;";
    expect(measureSourceDebt(new Map([
      ["a.ts", exactWindow],
      ["b.ts", exactWindow],
    ]), { duplicateTokenFloor: 8 })).toEqual({ duplicateBlocks: 1, maximumCyclomaticComplexity: 2 });
    expect(measureSourceDebt(new Map([
      ["a.ts", "same"],
      ["b.ts", "same"],
      ["c.ts", "different"],
    ]), { duplicateTokenFloor: 1 })).toEqual({ duplicateBlocks: 1, maximumCyclomaticComplexity: 1 });
    expect(measureSourceDebt(new Map([
      ["a.ts", "if (a) while (b) value ?? fallback"],
      ["b.ts", "plain"],
    ]), { duplicateTokenFloor: 50 })).toEqual({ duplicateBlocks: 0, maximumCyclomaticComplexity: 4 });
    expect(measureSourceDebt(new Map([
      ["a.ts", ""],
      ["b.ts", "   "],
    ]), { duplicateTokenFloor: 1 })).toEqual({ duplicateBlocks: 0, maximumCyclomaticComplexity: 1 });
    expect(measureSourceDebt(new Map([
      ["a.ts", "alpha beta"],
      ["b.ts", "gamma delta"],
    ]), { duplicateTokenFloor: 2 })).toEqual({ duplicateBlocks: 0, maximumCyclomaticComplexity: 1 });
    expect(measureSourceDebt(new Map([
      ["a.ts", "ab c"],
      ["b.ts", "a bc"],
    ]), { duplicateTokenFloor: 2 })).toEqual({ duplicateBlocks: 0, maximumCyclomaticComplexity: 1 });
  });

  it("exhausts complexity paths, route ordering, and typed route denominators", async () => {
    const { calculateRouteJourneyCoverage, calculateTypedJourneyCoverage, evaluateChangedFunctionComplexity } = await loadQualityModule();
    expect(evaluateChangedFunctionComplexity([
      { filePath: "C:\\repo\\src\\a.ts", messages: [{ ruleId: "complexity", line: 3, message: "complexity of 2" }] },
      { filePath: "C:\\repo\\src\\b.ts", messages: [{ ruleId: "complexity", line: 4, message: "complexity of 4" }] },
    ], { productRoot: "C:\\repo\\", maximum: 3 })).toEqual({
      maximum: 4,
      offenders: [{ complexity: 4, file: "src/b.ts", line: 4 }],
    });
    expect(evaluateChangedFunctionComplexity([
      { filePath: "/outside/exact.ts", messages: [{ ruleId: "complexity", line: 1, message: "complexity of 3" }] },
    ], { productRoot: "/repo", maximum: 3 })).toEqual({ maximum: 3, offenders: [] });
    expect(calculateRouteJourneyCoverage(["/b", "/a", "/b"], ["/a"])).toEqual({
      covered: 1, percentage: 50, total: 2, uncovered: ["/b"],
    });
    expect(calculateRouteJourneyCoverage(["/z", "/a"], [])).toEqual({
      covered: 0, percentage: 0, total: 2, uncovered: ["/a", "/z"],
    });
    expect(calculateTypedJourneyCoverage(
      ["/z", "/api/b", "/a", "/api/a", "/z"],
      [{ routes: ["/z"] }],
      ["/api/a", "/api/a", "/not-in-inventory"],
    )).toEqual({
      apiContractCoverage: 50,
      browserJourneyCoverage: 50,
      routeJourneyCoverage: 50,
      details: {
        api: { covered: 1, total: 2, uncovered: ["/api/b"] },
        browser: { covered: 1, total: 2, uncovered: ["/a"] },
        combined: { covered: 2, total: 4, uncovered: ["/a", "/api/b"] },
      },
    });
  });

  it("fails closed for null journeys and accepts every declared journey mode", async () => {
    const { validateJourneyRegistry } = await loadQualityModule();
    const nullErrors = validateJourneyRegistry({ schemaVersion: "2.0.0", journeys: [null] });
    expect(nullErrors).toEqual([
      "Journey <missing> has an invalid mode.",
      "Journey <missing> requires an owner.",
      "Journey <missing> test file does not exist: <missing>.",
      "Journey <missing> requires routes.",
      "Journey <missing> requires assertions.",
    ]);
    for (const mode of ["public", "local-isolated", "staging-readonly"]) {
      const testFile = `${mode}.spec.ts`;
      expect(validateJourneyRegistry({
        schemaVersion: "2.0.0",
        journeys: [{
          id: mode,
          mode,
          owner: "quality",
          testFile,
          routes: ["/"],
          assertions: ["visible"],
          routeEvidence: { "/": "goto-root" },
          assertionEvidence: { visible: "visible-check" },
        }],
      }, {
        knownRoutes: new Set(["/"]),
        testFiles: new Set([testFile]),
        testSources: new Map([[testFile, "goto-root visible-check"]]),
      })).toEqual([]);
    }
    expect(validateJourneyRegistry({
      schemaVersion: "2.0.0",
      journeys: [{
        id: "scalar-evidence",
        mode: "public",
        owner: "quality",
        testFile: "scalar.spec.ts",
        routes: ["/"],
        assertions: ["visible"],
        routeEvidence: "invalid",
        assertionEvidence: 7,
      }],
    }, {
      knownRoutes: new Set(["/"]),
      testFiles: new Set(["scalar.spec.ts"]),
    })).toEqual([
      "Journey scalar-evidence requires route evidence: /.",
      "Journey scalar-evidence requires assertion evidence: visible.",
    ]);
    expect(validateJourneyRegistry("invalid")).toEqual(["Journey registry must be an object."]);
    expect(validateJourneyRegistry({
      schemaVersion: "2.0.0",
      journeys: [{
        id: "missing-source",
        mode: "public",
        owner: "quality",
        testFile: "missing-source.spec.ts",
        routes: ["/"],
        assertions: ["visible"],
        routeEvidence: { "/": "Stryker was here!" },
        assertionEvidence: { visible: "Stryker was here!" },
      }],
    }, {
      knownRoutes: new Set(["/"]),
      testFiles: new Set(["missing-source.spec.ts"]),
    })).toEqual([
      "Journey missing-source route evidence is not present in missing-source.spec.ts: /.",
      "Journey missing-source assertion evidence is not present in missing-source.spec.ts: visible.",
    ]);
  });

  it("exhausts emitted-code normalization and executable skip syntax", async () => {
    const { countSkippedTests, filterExecutableChanges } = await loadQualityModule();
    const files = ["empty.ts", "strict.ts", "export.ts", "anchored.ts", "spaced.ts", "whitespace.ts", "strict-tail.ts"];
    expect(filterExecutableChanges(files, {
      baseOutputs: new Map(files.map((file) => [file, ""])),
      headOutputs: new Map([
        ["empty.ts", undefined],
        ["strict.ts", "  'use strict'  "],
        ["export.ts", "\n export { } \n"],
        ["anchored.ts", "const before = true; 'use strict';"],
        ["spaced.ts", "\n\t\"use strict\";\n export { }; \n"],
        ["whitespace.ts", "  \n\t"],
        ["strict-tail.ts", "'use strict';XYZ"],
      ]),
    })).toEqual(["anchored.ts", "strict-tail.ts"]);
    expect(filterExecutableChanges(["inline-strict.ts", "inline-export.ts", "tight-export.ts", "export-tail.ts"], {
      baseOutputs: new Map([
        ["inline-strict.ts", "const x = 1;"],
        ["inline-export.ts", "const x = 1;"],
        ["tight-export.ts", ""],
        ["export-tail.ts", "const x = 1;"],
      ]),
      headOutputs: new Map([
        ["inline-strict.ts", "const x = 1; 'use strict';"],
        ["inline-export.ts", "const x = 1; export {};"],
        ["tight-export.ts", "export{}"],
        ["export-tail.ts", "export {}; const x = 1;"],
      ]),
    })).toEqual(["inline-strict.ts", "inline-export.ts", "export-tail.ts"]);
    expect(countSkippedTests("test.skipper('not a skip', () => {})")).toBe(0);
    expect(countSkippedTests("describe.skip(\n  'suite', () => {}\n)\nit.skip('case', () => {})")).toBe(2);

    const source = await readFile(path.join(process.cwd(), "scripts/harness/quality.mjs"), "utf8");
    expect(source).toContain("token grammar is exhaustively specified");
    expect(source).toContain("emitted preamble normalization is exhaustively specified");
    expect(source).toContain("absent report messages cannot create a complexity measurement");
    expect(source).toContain("missing message text is always malformed");
  });

  it("does not confuse embedded test-like suffixes with test files", async () => {
    const { selectMutationTargets } = await loadQualityModule();
    expect(selectMutationTargets(["src/a.test.ts.fake.ts"], { maximumFiles: 1 }))
      .toEqual(["src/a.test.ts.fake.ts"]);
  });
});
