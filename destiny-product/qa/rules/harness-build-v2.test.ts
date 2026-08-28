import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

async function loadBuildWarnings() {
  const modulePath = "../../scripts/harness/" + "ratchet.mjs";
  return import(/* @vite-ignore */ modulePath);
}

const warning = {
  id: "html-to-docx-optional-encoding",
  fingerprint: "Module not found: Can't resolve 'encoding'",
  owner: "platform-build",
  reason: "Optional node-fetch peer used by html-to-docx.",
  expiresAt: "2026-09-05T00:00:00.000Z",
};

describe("production build warning ratchet", () => {
  it("accepts exactly one current declared warning", async () => {
    const { evaluateBuildWarnings } = await loadBuildWarnings();
    expect(evaluateBuildWarnings([
      "Compiled with warnings",
      warning.fingerprint,
    ].join("\n"), { schemaVersion: "2.0.0", warnings: [warning] }, new Date("2026-08-28T00:00:00.000Z"))).toEqual({
      errors: [],
      matched: [{ count: 1, id: warning.id }],
      unknownWarnings: [],
    });
  });

  it("fails closed for unknown or multiplied warnings", async () => {
    const { evaluateBuildWarnings } = await loadBuildWarnings();
    const result = evaluateBuildWarnings([
      "Compiled with warnings",
      warning.fingerprint,
      warning.fingerprint,
      "Critical dependency: the request of a dependency is an expression",
    ].join("\n"), { schemaVersion: "2.0.0", warnings: [warning] }, new Date("2026-08-28T00:00:00.000Z"));
    expect(result.errors).toEqual(expect.arrayContaining([
      "Build warning html-to-docx-optional-encoding occurred 2 times; expected exactly 1.",
      "Unknown build warning: Critical dependency: the request of a dependency is an expression",
    ]));
  });

  it("forces removal of stale allowances and review of expired warnings", async () => {
    const { evaluateBuildWarnings } = await loadBuildWarnings();
    expect(evaluateBuildWarnings("Compiled successfully", { schemaVersion: "2.0.0", warnings: [warning] }, new Date("2026-08-28T00:00:00.000Z")).errors)
      .toContain("Declared build warning disappeared; remove its allowance: html-to-docx-optional-encoding.");
    expect(evaluateBuildWarnings(`Compiled with warnings\n${warning.fingerprint}`, { schemaVersion: "2.0.0", warnings: [warning] }, new Date("2026-09-05T00:00:00.000Z")).errors)
      .toContain("Build warning allowance has expired: html-to-docx-optional-encoding.");
  });

  it("routes the production build through the receipt-producing wrapper", async () => {
    const packageJson = JSON.parse(await readFile(path.join(process.cwd(), "package.json"), "utf8"));
    expect(packageJson.scripts.build).toBe("node scripts/qa-build.mjs");
    const runner = await readFile(path.join(process.cwd(), "scripts/qa-build.mjs"), "utf8");
    expect(runner).toContain("write-build-stamp.mjs");
    expect(runner).toContain("build-warnings.v2.json");
    expect(runner).toContain("build/build.json");
    expect(runner).toContain('"--webpack"');
  });

  it("keeps every harness policy suite in mutation test selection", async () => {
    const mutationConfig = await readFile(path.join(process.cwd(), "vitest.sota.config.mjs"), "utf8");
    expect(mutationConfig).toContain('"qa/rules/harness-*-v2.test.ts"');
    expect(mutationConfig).toContain('"qa/rules/dependency-audit-policy.test.ts"');
    expect(mutationConfig).toContain('"qa/rules/build-provenance-policy.test.ts"');
    expect(mutationConfig).not.toContain('"qa/rules/**/*.test.ts"');
  });
});
