import { describe, expect, it } from "vitest";
import { classifyGovernanceChange, evaluateTypedChecklist } from "../../scripts/governance-policy.mjs";

const manifest = {
  schemaVersion: "2.0.0",
  changeId: "D-HARNESS-SOTA-2",
  classification: "HIGH",
  decision: { id: "D-HARNESS-SOTA-2", path: "destiny-product/DEPLOY_LOG.md#d-harness-sota-2" },
  redReplay: {
    mode: "required",
    redCommit: "a".repeat(40),
    command: ["node", "node_modules/vitest/vitest.mjs", "run", "qa/rules/example.test.ts"],
    failurePattern: "expected",
    testFiles: ["destiny-product/qa/rules/example.test.ts"],
    implementationPaths: ["destiny-product/scripts/harness/example.mjs"],
  },
  networkMode: "mocked",
  touchedRoutes: [],
  productPaths: [],
};

describe("typed governance evidence", () => {
  it("validates the manifest and requires only a stable PR pointer", () => {
    expect(evaluateTypedChecklist("Evidence manifest: `.github/destiny-evidence.json`", manifest)).toEqual({
      classification: "HIGH",
      errors: [],
    });
    expect(evaluateTypedChecklist("", manifest).errors).toContain("PR body must point to .github/destiny-evidence.json.");
    expect(evaluateTypedChecklist("Evidence manifest: .github/destiny-evidence.json", { ...manifest, surprise: true }).errors)
      .toContain("Unexpected evidence field: surprise.");
  });

  it("freezes the manifest, schemas, baselines, and enforcement implementation", () => {
    for (const file of [
      ".github/destiny-evidence.json",
      "destiny-product/qa/harness/evidence.schema.json",
      "destiny-product/qa/harness/baseline.v2.json",
      "destiny-product/scripts/harness/trace.mjs",
      "destiny-product/scripts/qa-harness-v2.mjs",
    ]) expect(classifyGovernanceChange([file]).level, file).toBe("HIGH");
  });
});
