import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  detectDependencyCycles,
  evaluateArchitectureImports,
  parseModuleSpecifiers,
  resolveLocalSpecifier,
} from "./harness/architecture.mjs";
import { calculateRouteJourneyCoverage, measureSourceDebt } from "./harness/quality.mjs";
import { compareRatchetMetrics } from "./harness/ratchet.mjs";

const implementationProductRoot = path.resolve(import.meta.dirname, "..");
const productRoot = process.env.QA_MEASURE_ROOT ? path.resolve(process.env.QA_MEASURE_ROOT) : implementationProductRoot;
const repositoryRoot = process.env.QA_MEASURE_REPOSITORY_ROOT
  ? path.resolve(process.env.QA_MEASURE_REPOSITORY_ROOT)
  : path.resolve(productRoot, "..");
const artifactRoot = path.join(implementationProductRoot, "qa", "artifacts", "harness", "quality");
const baselinePath = path.join(productRoot, "qa", "harness", "baseline.v2.json");
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const ignored = new Set([".next", ".stryker-tmp", "coverage", "node_modules", "qa/artifacts"]);
await mkdir(artifactRoot, { recursive: true });

async function walk(directory, relative = "") {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const childRelative = path.posix.join(relative, entry.name);
    if ([...ignored].some((item) => childRelative === item || childRelative.startsWith(`${item}/`))) continue;
    const child = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(child, childRelative));
    else if (sourceExtensions.has(path.extname(entry.name))) files.push(childRelative);
  }
  return files;
}

function resolveExistingModule(candidate, fileSet) {
  const candidates = [candidate, ...[...sourceExtensions].map((extension) => `${candidate}${extension}`), ...[...sourceExtensions].map((extension) => `${candidate}/index${extension}`)];
  return candidates.find((item) => fileSet.has(item)) ?? null;
}

function git(args) {
  return execFileSync("git", args, { cwd: repositoryRoot, encoding: "utf8" }).trim();
}

const allFiles = await walk(productRoot);
const productionFiles = allFiles.filter((file) => !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file));
const testFiles = allFiles.filter((file) => /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file));
const sources = new Map(await Promise.all(productionFiles.map(async (file) => [file, await readFile(path.join(productRoot, file), "utf8")])));
const fileSet = new Set(productionFiles);
const imports = [];
const graph = new Map(productionFiles.map((file) => [file, []]));
for (const [file, source] of sources) {
  for (const specifier of parseModuleSpecifiers(source)) {
    const local = resolveLocalSpecifier(file, specifier);
    const resolved = local ? resolveExistingModule(local, fileSet) : null;
    imports.push({ file, specifier, ...(resolved ? { resolved } : {}) });
    if (resolved) graph.get(file).push(resolved);
  }
}
const architectureErrors = evaluateArchitectureImports(imports);
const cycles = detectDependencyCycles(graph);
const debt = measureSourceDebt(sources, { duplicateTokenFloor: 40 });
function requireCleanCommand(label, executable, args) {
  const result = spawnSync(executable, args, { cwd: productRoot, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${label} failed.\n${result.stdout ?? ""}${result.stderr ?? ""}`.trim());
  }
}

requireCleanCommand("ESLint zero-warning gate", path.join(implementationProductRoot, "node_modules", ".bin", "eslint"), [
  ".", "--max-warnings", "0",
]);
requireCleanCommand("TypeScript no-emit gate", path.join(implementationProductRoot, "node_modules", ".bin", "tsc"), [
  "--noEmit",
]);
const duplicationOutput = path.join(artifactRoot, "jscpd");
const duplicationRun = spawnSync(path.join(implementationProductRoot, "node_modules", ".bin", "jscpd"), [
  "src", "scripts", "--min-tokens", "50", "--min-lines", "5", "--format", "typescript,javascript",
  "--reporters", "json", "--output", duplicationOutput, "--exit-code", "0", "--silent", "--no-colors",
], { cwd: productRoot, encoding: "utf8" });
if (duplicationRun.status !== 0) throw new Error(`jscpd measurement failed: ${duplicationRun.stderr || duplicationRun.stdout}`);
const duplicationReport = JSON.parse(await readFile(path.join(duplicationOutput, "jscpd-report.json"), "utf8"));
const testSources = await Promise.all(testFiles.map((file) => readFile(path.join(productRoot, file), "utf8")));
const joinedTests = testSources.join("\n");
const routes = JSON.parse(await readFile(path.join(productRoot, "qa", "inventory", "routes.json"), "utf8")).map((entry) => entry.route);
const e2eFiles = testFiles.filter((file) => file.startsWith("qa/e2e/"));
const e2eSource = (await Promise.all(e2eFiles.map((file) => readFile(path.join(productRoot, file), "utf8")))).join("\n");
const routeLiterals = [...e2eSource.matchAll(/["'`](\/[A-Za-z0-9_\/\[\]-]+)(?:\?[^"'`]*)?["'`]/g)].map((match) => match[1]);
const routeCoverage = calculateRouteJourneyCoverage(routes, routeLiterals);
const workspace = await readFile(path.join(productRoot, "pnpm-workspace.yaml"), "utf8");
const metrics = {
  architectureViolations: architectureErrors.length,
  auditExceptions: [...workspace.matchAll(/^\s+- GHSA-/gm)].length,
  dependencyCycles: cycles.length,
  duplicateBlocks: duplicationReport.statistics.total.clones,
  duplicationPercentage: Math.round(duplicationReport.statistics.total.percentage * 100) / 100,
  eslintWarnings: 0,
  flakyRetries: 0,
  maximumCyclomaticComplexity: debt.maximumCyclomaticComplexity,
  quarantinedTests: (joinedTests.match(/QA_QUARANTINE/g) ?? []).length,
  routeJourneyCoverage: routeCoverage.percentage,
  skippedTests: (joinedTests.match(/\b(?:it|test|describe)\.skip\s*\(/g) ?? []).length,
  testCount: (joinedTests.match(/\b(?:it|test)\s*\(/g) ?? []).length,
  typeErrors: 0,
};
const report = {
  schemaVersion: "2.0.0",
  measuredAtSha: git(["rev-parse", "HEAD"]),
  metrics,
  details: { architectureErrors, cycles, routeCoverage },
};
await writeFile(path.join(artifactRoot, "static-quality.json"), `${JSON.stringify(report, null, 2)}\n`);

if (process.argv.includes("--measure")) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exit(0);
}

const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
const errors = compareRatchetMetrics(baseline.metrics, metrics, { ceilings: baseline.ceilings });
if (errors.length) throw new Error(errors.join("\n"));
process.stdout.write(`Static quality PASS: ${productionFiles.length} source files, ${architectureErrors.length} architecture violation(s), ${cycles.length} cycle(s).\n`);
