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
      "evaluateBuildWarnings",
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
        "evaluateBuildWarnings",
      ].join("\n"),
    })).toEqual(expect.arrayContaining([
      "Build stamp must run before the Next.js production build.",
      "Production build must persist its evidence receipt.",
    ]));
  });
});
