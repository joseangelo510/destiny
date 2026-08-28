import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { selectMutationTargets } from "./harness/quality.mjs";
import { compareRatchetMetrics } from "./harness/ratchet.mjs";

const productRoot = path.resolve(import.meta.dirname, "..");
const repositoryRoot = path.resolve(productRoot, "..");
const artifactRoot = path.join(productRoot, "qa", "artifacts", "harness", "mutation");
const baseline = JSON.parse(await readFile(path.join(productRoot, "qa", "harness", "baseline.v2.json"), "utf8"));

function git(args) {
  return execFileSync("git", args, { cwd: repositoryRoot, encoding: "utf8" }).trim();
}

function baseRef() {
  if (process.env.QA_BASE_REF) return process.env.QA_BASE_REF;
  for (const candidate of ["origin/main", "github/main"]) {
    if (spawnSync("git", ["rev-parse", "--verify", "--quiet", candidate], { cwd: repositoryRoot }).status === 0) return candidate;
  }
  throw new Error("Changed mutation testing requires a canonical protected-main ref.");
}

function mutationScore(report) {
  const mutants = Object.values(report.files ?? {}).flatMap((file) => file.mutants ?? []);
  const ignored = new Set(["Ignored", "CompileError"]);
  const detected = new Set(["Killed", "Timeout"]);
  const scored = mutants.filter((mutant) => !ignored.has(mutant.status));
  const killed = scored.filter((mutant) => detected.has(mutant.status)).length;
  return {
    killed,
    score: scored.length === 0 ? 100 : Math.round((killed / scored.length) * 10_000) / 100,
    total: scored.length,
  };
}

const base = baseRef();
const changed = git(["diff", "--name-only", `${base}...HEAD`]).split("\n")
  .filter(Boolean).map((file) => file.replace(/^destiny-product\//, ""));
const targets = selectMutationTargets(changed, { maximumFiles: 12 });
await mkdir(artifactRoot, { recursive: true });
if (targets.length === 0) {
  const empty = { schemaVersion: "2.0.0", baseRef: base, targets, metrics: { changedMutationScore: 100 } };
  await writeFile(path.join(artifactRoot, "changed-mutation.json"), `${JSON.stringify(empty, null, 2)}\n`);
  process.stdout.write("Changed mutation PASS: no changed source files.\n");
  process.exit(0);
}

const reportPath = path.join(artifactRoot, "mutation.json");
const started = performance.now();
const run = spawnSync(process.execPath, [path.join(productRoot, "node_modules", "@stryker-mutator", "core", "bin", "stryker.js"), "run", "stryker.config.mjs"], {
  cwd: productRoot,
  env: {
    ...process.env,
    QA_MUTATION_TARGETS: JSON.stringify(targets),
    QA_MUTATION_REPORT: reportPath,
    QA_NETWORK_MODE: "mocked",
  },
  stdio: "inherit",
  timeout: baseline.ceilings.changedMutationSeconds * 1000,
});
const durationSeconds = Math.round((performance.now() - started) / 100) / 10;
if (run.signal) throw new Error(`Changed mutation exceeded its ${baseline.ceilings.changedMutationSeconds}s runtime cap.`);
if (run.status !== 0) throw new Error(`Changed mutation run failed with status ${run.status ?? "unknown"}.`);
const score = mutationScore(JSON.parse(await readFile(reportPath, "utf8")));
const metrics = { changedMutationScore: score.score };
const errors = compareRatchetMetrics(baseline.metrics, metrics);
const receipt = { schemaVersion: "2.0.0", baseRef: base, targets, durationSeconds, score, metrics, errors };
await writeFile(path.join(artifactRoot, "changed-mutation.json"), `${JSON.stringify(receipt, null, 2)}\n`);
if (errors.length) throw new Error(errors.join("\n"));
process.stdout.write(`Changed mutation PASS: ${score.score}% (${score.killed}/${score.total}) across ${targets.length} file(s) in ${durationSeconds}s.\n`);
