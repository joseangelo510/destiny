import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const productRoot = process.cwd();
const repositoryRoot = path.resolve(productRoot, "..");

async function text(relative: string) {
  return readFile(path.join(repositoryRoot, relative), "utf8");
}

describe("SOTA harness integration", () => {
  it("exposes one traced PR entrypoint and invokes it from the complete gate", async () => {
    const packageJson = JSON.parse(await text("destiny-product/package.json"));
    expect(packageJson.scripts).toEqual(expect.objectContaining({
      "qa:evidence": "node scripts/qa-evidence.mjs",
      "qa:quality": "node scripts/qa-quality-gate.mjs",
      "qa:coverage": "node scripts/qa-coverage.mjs",
      "qa:mutation": "node scripts/qa-mutation.mjs",
      "qa:capabilities": "node scripts/qa-capabilities.mjs",
      "qa:capabilities:required": "node scripts/qa-capabilities.mjs --require-container",
      "qa:harness-v2": "node scripts/qa-harness-v2.mjs",
    }));
    const completeGate = await text("destiny-product/scripts/qa-gate.mjs");
    expect(completeGate).toContain('runPnpm(["qa:capabilities:required"]);');
    expect(completeGate.indexOf('runPnpm(["qa:capabilities:required"]);'))
      .toBeLessThan(completeGate.indexOf('runPnpm(["qa:harness-v2"]);'));
    const runner = await text("destiny-product/scripts/qa-harness-v2.mjs");
    for (const step of ["qa:capabilities", "qa:evidence", "qa:quality", "qa:coverage", "qa:mutation"]) expect(runner).toContain(step);
    expect(runner).toContain("capabilities/capabilities.json");
    expect(runner).toContain("createTraceRecorder");
    expect(runner).toContain("hashEvidenceFiles");
    const quality = await text("destiny-product/scripts/qa-quality-gate.mjs");
    expect(quality).toContain("--max-warnings");
    expect(quality).toContain("--noEmit");
    expect(quality).toContain("changedMaximumFunctionComplexity");
    expect(quality).toContain("filterExecutableChanges");
    expect(quality).toContain('"complexity"');
  });

  it("preserves harness receipts and runs a bounded scheduled assurance lane", async () => {
    expect(await text(".github/workflows/ci.yml")).toContain("qa/artifacts/harness/");
    const nightly = await text(".github/workflows/nightly-assurance.yml");
    expect(nightly).toContain("schedule:");
    expect(nightly).toContain("qa:harness-v2");
    expect(nightly).toContain("repeat-each=2");
    expect(nightly).toContain("timeout-minutes: 120");
  });

  it("makes the typed evidence manifest the PR contract", async () => {
    expect(await text("HARNESS_POLICY.md")).toContain(".github/destiny-evidence.json");
    expect(await text(".github/pull_request_template.md")).toContain(".github/destiny-evidence.json");
  });

  it("schema-validates capability receipts before any full local gate", async () => {
    const schema = JSON.parse(await text("destiny-product/qa/harness/capabilities.schema.json"));
    expect(schema).toEqual(expect.objectContaining({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      additionalProperties: false,
      type: "object",
    }));
    const capabilityGate = await text("destiny-product/scripts/qa-capabilities.mjs");
    expect(capabilityGate).toContain("Ajv2020");
    expect(capabilityGate).toContain("capabilities.schema.json");
    expect(capabilityGate).toContain("capabilities/capabilities.json");
    expect(capabilityGate).toContain("capabilities/required-capabilities.json");
  });
});
