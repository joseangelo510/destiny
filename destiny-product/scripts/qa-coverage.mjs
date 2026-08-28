import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { calculateChangedCoverage } from "./harness/quality.mjs";
import { compareRatchetMetrics } from "./harness/ratchet.mjs";
import { git, protectedMainRef } from "./harness/repository.mjs";

const productRoot = path.resolve(import.meta.dirname, "..");
const repositoryRoot = path.resolve(productRoot, "..");
const artifactRoot = path.join(productRoot, "qa", "artifacts", "harness", "coverage");
const baseline = JSON.parse(await readFile(path.join(productRoot, "qa", "harness", "baseline.v2.json"), "utf8"));

function baseRef() {
  return protectedMainRef({ repositoryRoot, override: process.env.QA_BASE_REF, purpose: "Changed coverage" });
}

function changedSourceFiles(base) {
  return git(repositoryRoot, ["diff", "--name-only", `${base}...HEAD`]).split("\n").filter((file) =>
    /^destiny-product\/(?:src\/.*\.[jt]sx?|scripts\/harness\/.*\.mjs)$/.test(file)
    && !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file));
}

function changedLines(base, repositoryFile) {
  const diff = git(repositoryRoot, ["diff", "--unified=0", "--no-color", `${base}...HEAD`, "--", repositoryFile]);
  const lines = new Set();
  for (const match of diff.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)) {
    const start = Number(match[1]);
    const count = match[2] === undefined ? 1 : Number(match[2]);
    for (let offset = 0; offset < count; offset += 1) lines.add(start + offset);
  }
  return lines;
}

function normalizedCoverage(raw) {
  const coverage = {};
  for (const [absoluteFile, item] of Object.entries(raw)) {
    const file = path.relative(productRoot, absoluteFile).replaceAll("\\", "/");
    const lines = {};
    for (const [statementId, location] of Object.entries(item.statementMap ?? {})) {
      const line = location.start.line;
      lines[line] = (lines[line] ?? 0) + (item.s?.[statementId] ?? 0);
    }
    const branches = {};
    for (const [branchId, branch] of Object.entries(item.branchMap ?? {})) {
      const line = branch.loc?.start?.line ?? branch.locations?.[0]?.start?.line;
      if (line) branches[line] = [...(branches[line] ?? []), ...(item.b?.[branchId] ?? [])];
    }
    coverage[file] = { lines, branches };
  }
  return coverage;
}

const base = baseRef();
const repositoryFiles = changedSourceFiles(base);
const productFiles = repositoryFiles.map((file) => file.replace(/^destiny-product\//, ""));
const reportsDirectory = path.join(artifactRoot, "raw");
await mkdir(reportsDirectory, { recursive: true });
if (productFiles.length === 0) {
  const empty = { schemaVersion: "2.0.0", baseRef: base, files: [], metrics: { changedBranchCoverage: 100, changedLineCoverage: 100 } };
  await writeFile(path.join(artifactRoot, "changed-coverage.json"), `${JSON.stringify(empty, null, 2)}\n`);
  process.stdout.write("Changed coverage PASS: no changed source files.\n");
  process.exit(0);
}

const vitest = path.join(productRoot, "node_modules", "vitest", "vitest.mjs");
const run = spawnSync(process.execPath, [
  vitest,
  "run",
  "--coverage.enabled",
  "--coverage.provider", "v8",
  "--coverage.reporter", "json",
  "--coverage.reporter", "json-summary",
  "--coverage.reportsDirectory", reportsDirectory,
  "--coverage.include", "src/**/*.{ts,tsx}",
  "--coverage.include", "scripts/harness/**/*.mjs",
], { cwd: productRoot, env: { ...process.env, QA_NETWORK_MODE: "mocked" }, stdio: "inherit" });
if (run.status !== 0) throw new Error(`Coverage test run failed with status ${run.status ?? "unknown"}.`);

const raw = JSON.parse(await readFile(path.join(reportsDirectory, "coverage-final.json"), "utf8"));
const coverage = normalizedCoverage(raw);
const lineMap = new Map(repositoryFiles.map((repositoryFile) => {
  const file = repositoryFile.replace(/^destiny-product\//, "");
  const executableLines = new Set(Object.keys(coverage[file]?.lines ?? {}).map(Number));
  return [file, new Set([...changedLines(base, repositoryFile)].filter((line) => executableLines.has(line)))];
}));
const calculated = calculateChangedCoverage({ changedLines: lineMap, coverage });
const metrics = {
  changedBranchCoverage: calculated.branchCoverage,
  changedLineCoverage: calculated.lineCoverage,
};
const errors = compareRatchetMetrics(baseline.metrics, metrics);
const report = { schemaVersion: "2.0.0", baseRef: base, files: productFiles, metrics, calculated, errors };
await writeFile(path.join(artifactRoot, "changed-coverage.json"), `${JSON.stringify(report, null, 2)}\n`);
if (errors.length) throw new Error(errors.join("\n"));
process.stdout.write(`Changed coverage PASS: lines ${metrics.changedLineCoverage}%, branches ${metrics.changedBranchCoverage}% across ${productFiles.length} file(s).\n`);
