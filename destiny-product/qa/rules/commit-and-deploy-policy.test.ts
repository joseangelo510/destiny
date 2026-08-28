import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  findForbiddenTestMarkers,
  isTestFile,
  validateCommitShape,
} from "../../scripts/qa-commit-policy.mjs";

const root = process.cwd();

describe("Fable commit discipline and deploy log", () => {
  it("accepts separated RED/GREEN/QA commits and rejects mixed or weakened tests", () => {
    expect(validateCommitShape({
      subject: "red: prove the missing boundary",
      files: [{ path: "qa/rules/new.test.ts", status: "A" }],
    })).toEqual([]);
    expect(validateCommitShape({
      subject: "green: enforce the boundary",
      files: [{ path: "scripts/qa-policy.mjs", status: "A" }],
    })).toEqual([]);
    expect(validateCommitShape({
      subject: "qa: cover the edge case",
      files: [{ path: "qa/rules/edge.test.ts", status: "A" }],
    })).toEqual([]);
    expect(isTestFile("destiny-product/qa/helpers/api-route-contract.ts")).toBe(true);
    expect(isTestFile("destiny-product/src/helpers/api-route-contract.ts")).toBe(false);
    expect(validateCommitShape({
      subject: "qa: add reusable route-test support",
      files: [{ path: "destiny-product/qa/helpers/api-route-contract.ts", status: "A" }],
    })).toEqual([]);
    expect(validateCommitShape({
      subject: "green: mix implementation and tests",
      files: [
        { path: "src/lib/db/index.ts", status: "A" },
        { path: "qa/rules/db.test.ts", status: "A" },
      ],
    })).toEqual(expect.arrayContaining([expect.stringMatching(/mixed|test file/i)]));
    expect(validateCommitShape({
      subject: "red: rewrite an old expectation",
      files: [{ path: "src/lib/old.test.ts", status: "M" }],
    })).toEqual(expect.arrayContaining([expect.stringContaining("test-change:")]));
  });

  it("rejects focused, skipped, and todo tests added by a release diff", () => {
    const diff = [
      "+it.only('focus', () => {})",
      "+test.skip('skip', () => {})",
      "+describe.todo('later')",
      "+xit('disabled', () => {})",
    ].join("\n");
    expect(findForbiddenTestMarkers(diff)).toHaveLength(4);
    expect(findForbiddenTestMarkers("+it('runs', () => {})\n-context.only")).toEqual([]);
  });

  it("does not mistake fixture text, comments, or regular expressions for executable test markers", () => {
    const diff = [
      "+expect(countSkippedTests(\"describe.skip('suite', () => {})\\nit.skip('case', () => {})\")).toBe(2)",
      "+const marker = /test\\.only\\s*\\(/",
      "+const documentation = `describe.todo('documented')`",
      "+// xit('commented out', () => {})",
    ].join("\n");
    expect(findForbiddenTestMarkers(diff)).toEqual([]);
    const isolatedMarker = "+it.skip('real skip', () => {})";
    expect(findForbiddenTestMarkers(["+const incompleteFixture = `text", isolatedMarker].join("\n")))
      .toEqual([isolatedMarker]);
  });

  it("locks policy activation to a full SHA and provides every required deploy field", async () => {
    const policy = JSON.parse(await readFile(path.join(root, "commit-policy.json"), "utf8")) as {
      policyVersion?: number;
      activationSha?: string;
    };
    expect(policy.policyVersion).toBe(1);
    expect(policy.activationSha).toMatch(/^[0-9a-f]{40}$/);

    const log = await readFile(path.join(root, "DEPLOY_LOG.md"), "utf8");
    for (const field of [
      "date",
      "shipped commit SHA",
      "tag",
      "PR links",
      "gate run link",
      "summary counts",
      "RED evidence links",
      "commit discipline",
      "isolation matrix",
      "test-change",
      "migrations",
      "features and blast radius",
      "rollback command",
      "deployer",
      "post-deploy smoke",
      "legacy-evidence",
    ]) expect(log.toLocaleLowerCase()).toContain(field.toLocaleLowerCase());
  });
});
