import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const productRoot = process.cwd();

async function loadBuildPolicy() {
  const modulePath = "../../scripts/harness/" + "ratchet.mjs";
  return import(/* @vite-ignore */ modulePath);
}

describe("build provenance policy", () => {
  it("makes the receipt-producing build wrapper non-bypassable", async () => {
    const { validateBuildProvenance } = await loadBuildPolicy();
    const packageJson = JSON.parse(await readFile(path.join(productRoot, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    const runnerSource = await readFile(path.join(productRoot, "scripts/qa-build.mjs"), "utf8");

    expect(validateBuildProvenance({
      buildScript: packageJson.scripts?.build,
      prebuildScript: packageJson.scripts?.prebuild,
      runnerSource,
    })).toEqual([]);
  });

  it("rejects direct builds, lifecycle bypasses, wrong ordering, and missing receipts", async () => {
    const { validateBuildProvenance } = await loadBuildPolicy();
    const validRunner = [
      "write-build-stamp.mjs",
      '[\"next\", \"build\", \"--webpack\"]',
      "const evaluation = evaluateBuildWarnings(",
      "writeFile(artifactPath",
    ].join("\n");

    expect(validateBuildProvenance({
      buildScript: "next build --webpack",
      prebuildScript: "node scripts/write-build-stamp.mjs",
      runnerSource: validRunner,
    })).toEqual(expect.arrayContaining([
      "Production build must route through scripts/qa-build.mjs.",
      "Production build must not use a bypassable prebuild lifecycle hook.",
    ]));
    expect(validateBuildProvenance({
      buildScript: "node scripts/qa-build.mjs",
      runnerSource: [
        '[\"next\", \"build\", \"--webpack\"]',
        "write-build-stamp.mjs",
        "const evaluation = evaluateBuildWarnings(",
      ].join("\n"),
    })).toEqual(expect.arrayContaining([
      "Build stamp must run before the Next.js production build.",
      "Production build must persist its evidence receipt.",
    ]));
  });

  it("rejects each missing or misordered wrapper stage independently", async () => {
    const { validateBuildProvenance } = await loadBuildPolicy();
    expect(validateBuildProvenance({ buildScript: "node scripts/qa-build.mjs", runnerSource: "" })).toEqual([
      "Production build wrapper must create a build stamp.",
      "Production build wrapper must invoke Next.js with webpack.",
      "Build warnings must be evaluated after the production build.",
      "Production build must persist its evidence receipt.",
    ]);
    expect(validateBuildProvenance({
      buildScript: "node scripts/qa-build.mjs",
      runnerSource: [
        "writeFile(artifactPath",
        "const evaluation = evaluateBuildWarnings(",
        "write-build-stamp.mjs",
        '["next", "build", "--webpack"]',
      ].join("\n"),
    })).toEqual(expect.arrayContaining([
      "Production build receipt must be written after warning evaluation.",
    ]));
  });

  it("exhausts zero-index, missing-stage, and adjacent-stage ordering", async () => {
    const { validateBuildProvenance } = await loadBuildPolicy();
    const buildScript = "node scripts/qa-build.mjs";
    const valid = [
      "write-build-stamp.mjs",
      '["next", "build", "--webpack"]',
      "const evaluation = evaluateBuildWarnings(",
      "writeFile(artifactPath",
    ].join("|");
    expect(validateBuildProvenance({ buildScript, runnerSource: valid })).toEqual([]);
    expect(validateBuildProvenance()).toEqual([
      "Production build must route through scripts/qa-build.mjs.",
      "Production build wrapper must create a build stamp.",
      "Production build wrapper must invoke Next.js with webpack.",
      "Build warnings must be evaluated after the production build.",
      "Production build must persist its evidence receipt.",
    ]);
    expect(validateBuildProvenance({ buildScript, runnerSource: [
      '["next", "build", "--webpack"]',
      "write-build-stamp.mjs",
      "const evaluation = evaluateBuildWarnings(",
      "writeFile(artifactPath",
    ].join("|") })).toContain("Build stamp must run before the Next.js production build.");
    expect(validateBuildProvenance({ buildScript, runnerSource: '["next", "build", "--webpack"]' })).toEqual([
      "Production build wrapper must create a build stamp.",
      "Build warnings must be evaluated after the production build.",
      "Production build must persist its evidence receipt.",
    ]);
    expect(validateBuildProvenance({ buildScript, runnerSource: "write-build-stamp.mjs" })).toEqual([
      "Production build wrapper must invoke Next.js with webpack.",
      "Build warnings must be evaluated after the production build.",
      "Production build must persist its evidence receipt.",
    ]);
    expect(validateBuildProvenance({ buildScript, runnerSource: "const evaluation = evaluateBuildWarnings(" })).toEqual([
      "Production build wrapper must create a build stamp.",
      "Production build wrapper must invoke Next.js with webpack.",
      "Production build must persist its evidence receipt.",
    ]);
    expect(validateBuildProvenance({ buildScript, runnerSource: "writeFile(artifactPath" })).toEqual([
      "Production build wrapper must create a build stamp.",
      "Production build wrapper must invoke Next.js with webpack.",
      "Build warnings must be evaluated after the production build.",
    ]);
    expect(validateBuildProvenance({ buildScript, runnerSource: [
      "write-build-stamp.mjs",
      "const evaluation = evaluateBuildWarnings(",
      '["next", "build", "--webpack"]',
      "writeFile(artifactPath",
    ].join("|") })).toContain("Build warnings must be evaluated after the production build.");

    const source = await readFile(path.join(productRoot, "scripts/harness/ratchet.mjs"), "utf8");
    expect(source).toContain("default runner sentinel cannot contain any stage marker");
    expect(source).toContain("distinct stage markers cannot occupy the same offset");
  });
});
