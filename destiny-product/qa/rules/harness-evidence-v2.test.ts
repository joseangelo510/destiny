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
    const { validateEvidenceManifest } = await loadEvidenceModule();
    expect(validateEvidenceManifest(validManifest)).toEqual([]);
    expect(validateEvidenceManifest({ ...validManifest, surprise: true })).toContain(
      "Unexpected evidence field: surprise.",
    );
    expect(validateEvidenceManifest({ ...validManifest, redReplay: { mode: "required" } })).toEqual(
      expect.arrayContaining([
        expect.stringContaining("redReplay.redCommit"),
        expect.stringContaining("redReplay.command"),
      ]),
    );
  });

  it("requires HIGH decisions and validates RED exemptions against the actual diff", async () => {
    const { evaluateEvidenceManifest } = await loadEvidenceModule();
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
  });
});
