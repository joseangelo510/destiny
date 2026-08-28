import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { filterExecutableChanges, selectMutationTargets } from "./harness/quality.mjs";
import { compareRatchetMetrics } from "./harness/ratchet.mjs";
import { git, protectedMainRef } from "./harness/repository.mjs";

const mutationProductRoot = path.resolve(import.meta.dirname, "..");
const mutationRepositoryRoot = path.resolve(mutationProductRoot, "..");
const mutationArtifactRoot = path.join(mutationProductRoot, "qa", "artifacts", "harness", "mutation");
const mutationBaseline = JSON.parse(await readFile(path.join(mutationProductRoot, "qa", "harness", "baseline.v2.json"), "utf8"));

function baseRef() {
  return protectedMainRef({ repositoryRoot: mutationRepositoryRoot, override: process.env.QA_BASE_REF, purpose: "Changed mutation testing" });
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

function fileAt(ref, file) {
  const result = spawnSync("git", ["show", `${ref}:destiny-product/${file}`], {
    cwd: mutationRepositoryRoot,
    encoding: "utf8",
  });
  return result.status === 0 ? result.stdout : "";
}

function emittedJavaScript(source, file) {
  if (!source) return "";
  return ts.transpileModule(source, {
    fileName: file,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}

const base = baseRef();
const changed = git(mutationRepositoryRoot, ["diff", "--name-only", `${base}...HEAD`]).split("\n")
  .filter(Boolean).map((file) => file.replace(/^destiny-product\//, ""));
const candidates = selectMutationTargets(changed, { maximumFiles: Number.MAX_SAFE_INTEGER });
const baseOutputs = new Map(candidates.map((file) => [file, emittedJavaScript(fileAt(base, file), file)]));
const headOutputs = new Map(await Promise.all(candidates.map(async (file) => [
  file,
  emittedJavaScript(await readFile(path.join(mutationProductRoot, file), "utf8"), file),
])));
const executableChanges = filterExecutableChanges(candidates, { baseOutputs, headOutputs });
const targets = selectMutationTargets(executableChanges, { maximumFiles: 12 });
const excludedTypeOnly = candidates.filter((file) => !targets.includes(file));
await mkdir(mutationArtifactRoot, { recursive: true });
if (targets.length === 0) {
  const empty = { schemaVersion: "2.0.0", baseRef: base, targets, excludedTypeOnly, metrics: { changedMutationScore: 100 } };
  await writeFile(path.join(mutationArtifactRoot, "changed-mutation.json"), `${JSON.stringify(empty, null, 2)}\n`);
  process.stdout.write("Changed mutation PASS: no changed source files.\n");
  process.exit(0);
}

const reportPath = path.join(mutationArtifactRoot, "mutation.json");
const started = performance.now();
const run = spawnSync(process.execPath, [path.join(mutationProductRoot, "node_modules", "@stryker-mutator", "core", "bin", "stryker.js"), "run", "stryker.config.mjs"], {
  cwd: mutationProductRoot,
  env: {
    ...process.env,
    QA_MUTATION_TARGETS: JSON.stringify(targets),
    QA_MUTATION_REPORT: reportPath,
    QA_NETWORK_MODE: "mocked",
  },
  stdio: "inherit",
  timeout: mutationBaseline.ceilings.changedMutationSeconds * 1000,
});
const durationSeconds = Math.round((performance.now() - started) / 100) / 10;
if (run.error?.code === "ETIMEDOUT" || run.signal || run.status === 143) {
  throw new Error(`Changed mutation exceeded its ${mutationBaseline.ceilings.changedMutationSeconds}s runtime cap.`);
}
if (run.status !== 0) throw new Error(`Changed mutation run failed with status ${run.status ?? "unknown"}.`);
const score = mutationScore(JSON.parse(await readFile(reportPath, "utf8")));
const metrics = { changedMutationScore: score.score };
const errors = compareRatchetMetrics(mutationBaseline.metrics, metrics);
const receipt = { schemaVersion: "2.0.0", baseRef: base, targets, excludedTypeOnly, durationSeconds, score, metrics, errors };
await writeFile(path.join(mutationArtifactRoot, "changed-mutation.json"), `${JSON.stringify(receipt, null, 2)}\n`);
if (errors.length) throw new Error(errors.join("\n"));
process.stdout.write(`Changed mutation PASS: ${score.score}% (${score.killed}/${score.total}) across ${targets.length} file(s) in ${durationSeconds}s.\n`);
