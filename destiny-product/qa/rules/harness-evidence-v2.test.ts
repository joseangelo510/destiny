import { describe, expect, it } from "vitest";
async function loadTraceModule() {
  const modulePath = "../../scripts/harness/" + "trace.mjs";
  return import(/* @vite-ignore */ modulePath);
}

async function loadEvidenceModule() {
  const modulePath = "../../scripts/harness/" + "evidence.mjs";
  return import(/* @vite-ignore */ modulePath);
}

const validManifest = {
  schemaVersion: "2.0.0",
  changeId: "D-HARNESS-SOTA-2",
  classification: "HIGH",
  decision: {
    id: "D-HARNESS-SOTA-2",
    path: "destiny-product/DEPLOY_LOG.md#d-harness-sota-2",
  },
  redReplay: {
    mode: "required",
    redCommit: "a".repeat(40),
    command: ["pnpm", "vitest", "run", "qa/rules/harness-evidence-v2.test.ts"],
    failurePattern: "Cannot find module",
    testFiles: ["destiny-product/qa/rules/harness-evidence-v2.test.ts"],
    implementationPaths: ["destiny-product/scripts/harness/trace.mjs"],
  },
  networkMode: "mocked",
  touchedRoutes: [],
  productPaths: [],
};

describe("SOTA harness evidence contract", () => {
  it("validates typed evidence and rejects unknown or incomplete fields", async () => {
    const { replayPlansFromManifest, validateEvidenceManifest } = await loadEvidenceModule();
    expect(validateEvidenceManifest(validManifest)).toEqual([]);
    const withTwoRedCycles = {
      ...validManifest,
      additionalRedReplays: [{
        ...validManifest.redReplay,
        redCommit: "b".repeat(40),
        testFiles: ["destiny-product/qa/rules/harness-quality-v2.test.ts"],
      }],
    };
    expect(validateEvidenceManifest(withTwoRedCycles)).toEqual([]);
    expect(replayPlansFromManifest(withTwoRedCycles)).toHaveLength(2);
    expect(validateEvidenceManifest({ ...validManifest, surprise: true })).toContain(
      "Unexpected evidence field: surprise.",
    );
    expect(validateEvidenceManifest({ ...validManifest, redReplay: { mode: "required" } })).toEqual(
      expect.arrayContaining([
        expect.stringContaining("redReplay.redCommit"),
        expect.stringContaining("redReplay.command"),
      ]),
    );
    expect(validateEvidenceManifest({ ...validManifest, redReplay: null })).toContain("Evidence requires redReplay.");
    expect(validateEvidenceManifest({ ...validManifest, additionalRedReplays: {} })).toContain(
      "additionalRedReplays must be an array.",
    );
  });

  it("requires HIGH decisions and validates RED exemptions against the actual diff", async () => {
    const { evaluateEvidenceManifest, validateEvidenceManifest } = await loadEvidenceModule();
    expect(evaluateEvidenceManifest(validManifest, {
      changedFiles: ["destiny-product/scripts/harness/trace.mjs"],
      isProtectedRevert: false,
    })).toEqual([]);

    const exempt = {
      ...validManifest,
      redReplay: { mode: "not-applicable", exemption: "docs-only" },
    };
    expect(evaluateEvidenceManifest(exempt, {
      changedFiles: ["destiny-product/scripts/harness/trace.mjs"],
      isProtectedRevert: false,
    })).toContain("RED exemption docs-only does not match the changed files.");
    expect(validateEvidenceManifest({
      ...validManifest,
      decision: { ...validManifest.decision, path: "README.md" },
    })).toContain("HIGH evidence decision.path must point to destiny-product/DEPLOY_LOG.md.");
  });

  it("recursively redacts credentials before emitting structured JSONL", async () => {
    const { createTraceRecorder, redactEvidence } = await loadTraceModule();
    const events: string[] = [];
    const recorder = createTraceRecorder({
      runId: "run-1",
      sha: "b".repeat(40),
      write: async (line: string) => events.push(line),
      now: () => 100,
    });

    await recorder.start("unit", { authorization: "Bearer private", nested: { token: "private" } });
    await recorder.finish("unit", "pass", { cookie: "private", count: 3 });

    expect(events).toHaveLength(2);
    expect(events.join("\n")).not.toContain("private");
    expect(events.map((line) => JSON.parse(line))).toEqual([
      expect.objectContaining({ schemaVersion: "2.0.0", phase: "start", stepId: "unit" }),
      expect.objectContaining({ schemaVersion: "2.0.0", phase: "finish", status: "pass" }),
    ]);
    expect(redactEvidence({ password: "p", value: "safe" })).toEqual({
      password: "[REDACTED]",
      value: "safe",
    });
  });

  it("hashes evidence deterministically regardless of input order", async () => {
    const { hashEvidenceFiles } = await loadTraceModule();
    const first = hashEvidenceFiles([
      { path: "b.json", contents: "two" },
      { path: "a.json", contents: "one" },
    ]);
    const second = hashEvidenceFiles([
      { path: "a.json", contents: "one" },
      { path: "b.json", contents: "two" },
    ]);
    expect(first).toEqual(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(hashEvidenceFiles([{ path: "a.json", contents: "one" }]))
      .toBe("6f73f38932569293198d4b5e2a2dd12c25961d8c6692d62050fd4c67bb2009af");
    expect(hashEvidenceFiles([{ path: "object.json", contents: { ok: true } }]))
      .toMatch(/^[0-9a-f]{64}$/);
    expect(hashEvidenceFiles([
      { path: "a.json", contents: { ok: true } },
      { path: "b.json", contents: "two" },
    ])).toBe("ba2bb755634f59ad089ba5fe1e5bd25b717f940c3500bbd247f0722933a42ec2");
  });

  it("fails closed on malformed evidence", async () => {
    const { validateEvidenceManifest } = await loadEvidenceModule();
    expect(validateEvidenceManifest(null)).toEqual(["Evidence manifest must be an object."]);
    expect(validateEvidenceManifest({
      ...validManifest,
      schemaVersion: "1.0.0",
      changeId: "x",
      classification: "LOW",
      networkMode: "internet",
      touchedRoutes: "none",
      productPaths: "none",
      redReplay: { mode: "maybe" },
    })).toEqual(expect.arrayContaining([
      "Evidence schemaVersion must be 2.0.0.",
      "Evidence changeId is invalid.",
      "Evidence classification must be MEDIUM or HIGH.",
      "Evidence networkMode is invalid.",
      "Evidence touchedRoutes must be an array.",
      "Evidence productPaths must be an array.",
      "redReplay.mode must be required or not-applicable.",
    ]));
  });

  it("accepts only mechanically provable RED exemptions", async () => {
    const { evaluateEvidenceManifest } = await loadEvidenceModule();
    const cases = [
      ["decision-record-only", ["destiny-product/DEPLOY_LOG.md"], false],
      ["docs-only", ["destiny-product/docs/a.md", "README.md"], false],
      ["protected-revert", ["destiny-product/src/lib/a.ts"], true],
      ["generated-inventory-only", ["destiny-product/qa/inventory/routes.json"], false],
    ] as const;
    for (const [exemption, changedFiles, isProtectedRevert] of cases) {
      expect(evaluateEvidenceManifest({
        ...validManifest,
        redReplay: { mode: "not-applicable", exemption },
      }, { changedFiles: [...changedFiles], isProtectedRevert })).toEqual([]);
    }
    expect(evaluateEvidenceManifest({
      ...validManifest,
      redReplay: { mode: "not-applicable", exemption: "because-i-said-so" },
    }, { changedFiles: ["README.md"] })).toEqual(expect.arrayContaining([
      "RED exemption is not allowed.",
      "RED exemption because-i-said-so does not match the changed files.",
    ]));
  });

  it("enforces trace lifecycle and serializes circular evidence", async () => {
    const { createTraceRecorder, redactEvidence } = await loadTraceModule();
    expect(() => createTraceRecorder({ sha: "short", write: async () => {} })).toThrow(/full Git SHA/);
    expect(() => createTraceRecorder({ sha: "a".repeat(40) })).toThrow(/write function/);
    const lines: string[] = [];
    let time = 10;
    const recorder = createTraceRecorder({ sha: "A".repeat(40), write: async (line: string) => lines.push(line), now: () => time });
    await recorder.start("build");
    await expect(recorder.start("build")).rejects.toThrow(/already started/);
    time = 7;
    await recorder.finish("build", "fail");
    expect(JSON.parse(lines[1])).toEqual(expect.objectContaining({ sha: "a".repeat(40), durationMs: 0, status: "fail" }));
    await expect(recorder.finish("missing", "pass")).rejects.toThrow(/did not start/);
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(redactEvidence(["Bearer abc123", circular])).toEqual(["Bearer [REDACTED]", { self: "[CIRCULAR]" }]);
    const defaults: string[] = [];
    const defaultRecorder = createTraceRecorder({ sha: "b".repeat(40), write: async (line: string) => defaults.push(line) });
    await defaultRecorder.start("default-clock");
    await defaultRecorder.finish("default-clock", "pass");
    expect(JSON.parse(defaults[0]).runId).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.parse(defaults[1]).durationMs).toEqual(expect.any(Number));
    await defaultRecorder.start("default-clock");
    await defaultRecorder.finish("default-clock", "pass");
    for (const invalidSha of [`x${"a".repeat(40)}`, `${"a".repeat(40)}x`]) {
      expect(() => createTraceRecorder({ sha: invalidSha, write: async () => {} })).toThrow(/full Git SHA/);
    }
    expect(redactEvidence(null)).toBeNull();
    expect(redactEvidence(7)).toBe(7);
    expect(redactEvidence(false)).toBe(false);
    expect(redactEvidence({
      servicerole_key: "private",
      service_rolekey: "private",
      apikey: "private",
      api_key: "private",
      spaced: "Bearer   abc123",
    })).toEqual({
      servicerole_key: "[REDACTED]",
      service_rolekey: "[REDACTED]",
      apikey: "[REDACTED]",
      api_key: "[REDACTED]",
      spaced: "Bearer [REDACTED]",
    });
  });

  it("fails closed when optional replay collections and HIGH metadata are absent", async () => {
    const { replayPlansFromManifest, validateEvidenceManifest } = await loadEvidenceModule();
    expect(replayPlansFromManifest(undefined)).toEqual([]);
    expect(replayPlansFromManifest(validManifest)).toEqual([validManifest.redReplay]);
    expect(validateEvidenceManifest({
      ...validManifest,
      changeId: undefined,
      decision: undefined,
      additionalRedReplays: [{ ...validManifest.redReplay, mode: "not-applicable", exemption: "docs-only" }],
    })).toEqual(expect.arrayContaining([
      "Evidence changeId is invalid.",
      "Evidence requires decision.id.",
      "HIGH evidence decision.path must point to destiny-product/DEPLOY_LOG.md.",
      "Additional RED replays must use required mode.",
    ]));
  });

  it("exhausts evidence scalar, argv, path, and exemption boundaries", async () => {
    const { evaluateEvidenceManifest, validateEvidenceManifest } = await loadEvidenceModule();
    for (const networkMode of ["mocked", "local-isolated", "staging-readonly", "authorized-live"]) {
      expect(validateEvidenceManifest({ ...validManifest, networkMode })).toEqual([]);
    }
    for (const changeId of [`x${validManifest.changeId}`, `${validManifest.changeId}x!`, "Stryker was here!"]) {
      expect(validateEvidenceManifest({ ...validManifest, changeId })).toContain("Evidence changeId is invalid.");
    }
    expect(validateEvidenceManifest({
      ...validManifest,
      classification: "MEDIUM",
      decision: undefined,
    })).toEqual([]);
    for (const path of ["destiny-product/DEPLOY_LOG.md", "destiny-product/DEPLOY_LOG.md#decision-1"]) {
      expect(validateEvidenceManifest({ ...validManifest, decision: { ...validManifest.decision, path } })).toEqual([]);
    }
    for (const path of [
      "prefix/destiny-product/DEPLOY_LOG.md",
      "destiny-product/DEPLOY_LOG.md/extra",
      "destiny-product/DEPLOY_LOG.md#",
    ]) expect(validateEvidenceManifest({ ...validManifest, decision: { ...validManifest.decision, path } }))
      .toContain("HIGH evidence decision.path must point to destiny-product/DEPLOY_LOG.md.");

    for (const requiredValue of [undefined, null, "", []]) {
      expect(validateEvidenceManifest({
        ...validManifest,
        redReplay: { ...validManifest.redReplay, failurePattern: requiredValue },
      })).toContain("Evidence requires redReplay.failurePattern.");
    }
    expect(validateEvidenceManifest({ ...validManifest, redReplay: null })).toEqual(["Evidence requires redReplay."]);
    expect(validateEvidenceManifest({ ...validManifest, redReplay: { ...validManifest.redReplay, redCommit: `x${"a".repeat(40)}` } }))
      .toContain("Evidence requires a full redReplay.redCommit SHA.");
    expect(validateEvidenceManifest({ ...validManifest, redReplay: { ...validManifest.redReplay, redCommit: `${"a".repeat(40)}x` } }))
      .toContain("Evidence requires a full redReplay.redCommit SHA.");
    for (const command of [[], ["pnpm", ""], ["pnpm", 7]]) {
      expect(validateEvidenceManifest({ ...validManifest, redReplay: { ...validManifest.redReplay, command } }))
        .toContain("redReplay.command must be a non-empty argv array.");
    }
    for (const testFiles of [
      ["qa/rules/a.test.ts.extra"],
      ["qa/rules/a.test.xts"],
      ["qa/rules/a.ts"],
    ]) expect(validateEvidenceManifest({ ...validManifest, redReplay: { ...validManifest.redReplay, testFiles } }))
      .toContain("redReplay.testFiles must contain test files only.");
    for (const testFile of ["qa/a.test.ts", "qa/a.spec.tsx", "qa/a.test.cts", "qa/a.spec.mjs"]) {
      expect(validateEvidenceManifest({ ...validManifest, redReplay: { ...validManifest.redReplay, testFiles: [testFile] } }))
        .toEqual([]);
    }

    expect(validateEvidenceManifest([])).toEqual(["Evidence manifest must be an object."]);
    expect(evaluateEvidenceManifest({ ...validManifest, redReplay: undefined })).toEqual(expect.arrayContaining([
      "Evidence requires redReplay.",
    ]));
    for (const [exemption, changedFiles] of [
      ["decision-record-only", ["prefix/destiny-product/DEPLOY_LOG.md"]],
      ["decision-record-only", ["destiny-product/DEPLOY_LOG.md.extra"]],
      ["docs-only", ["prefix/docs/readme.txt"]],
      ["docs-only", ["README.md.extra"]],
      ["docs-only", ["file.md.extra"]],
      ["generated-inventory-only", ["prefix/destiny-product/qa/inventory/routes.json"]],
    ] as const) expect(evaluateEvidenceManifest({
      ...validManifest,
      redReplay: { mode: "not-applicable", exemption },
    }, { changedFiles: [...changedFiles] })).toContain(`RED exemption ${exemption} does not match the changed files.`);
    expect(evaluateEvidenceManifest({
      ...validManifest,
      redReplay: { mode: "not-applicable", exemption: "docs-only" },
    }, { changedFiles: ["README.md", "src/app.ts"] })).toContain("RED exemption docs-only does not match the changed files.");
    expect(evaluateEvidenceManifest({
      ...validManifest,
      redReplay: { mode: "not-applicable", exemption: "docs-only" },
    })).toContain("RED exemption docs-only does not match the changed files.");
  });
});
