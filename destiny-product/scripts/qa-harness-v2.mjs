import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createTraceRecorder, hashEvidenceFiles } from "./harness/trace.mjs";

const productRoot = path.resolve(import.meta.dirname, "..");
const repositoryRoot = path.resolve(productRoot, "..");
const artifactRoot = path.join(productRoot, "qa", "artifacts", "harness");
const tracePath = path.join(artifactRoot, "trace.jsonl");
const summaryPath = path.join(artifactRoot, "summary.json");
const baseline = JSON.parse(await readFile(path.join(productRoot, "qa", "harness", "baseline.v2.json"), "utf8"));
const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot, encoding: "utf8" }).trim();
const runId = randomUUID();
const started = performance.now();

await mkdir(artifactRoot, { recursive: true });
await writeFile(tracePath, "");
const trace = createTraceRecorder({ runId, sha, write: (line) => appendFile(tracePath, line) });

function commandFor(script) {
  return process.env.npm_execpath ? [process.execPath, process.env.npm_execpath, script] : ["pnpm", script];
}

async function runStep(stepId) {
  const command = commandFor(stepId);
  await trace.start(stepId, { command });
  const result = spawnSync(command[0], command.slice(1), {
    cwd: productRoot,
    env: { ...process.env, QA_NETWORK_MODE: "mocked" },
    stdio: "inherit",
    shell: false,
  });
  const status = result.status === 0 ? "pass" : "fail";
  await trace.finish(stepId, status, { exitCode: result.status, signal: result.signal });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${stepId} failed with status ${result.status ?? "unknown"}.`);
}

for (const step of ["qa:capabilities", "qa:evidence", "qa:quality", "qa:coverage", "qa:mutation"]) await runStep(step);

const durationSeconds = Math.round((performance.now() - started) / 100) / 10;
if (durationSeconds > baseline.ceilings.prLaneSeconds) {
  throw new Error(`Harness exceeded its ${baseline.ceilings.prLaneSeconds}s PR-lane ceiling with ${durationSeconds}s.`);
}
const evidencePaths = [
  "capabilities/capabilities.json",
  "evidence/validation.json",
  "quality/static-quality.json",
  "coverage/changed-coverage.json",
  "mutation/changed-mutation.json",
];
const evidence = await Promise.all(evidencePaths.map(async (relative) => ({
  path: relative,
  contents: await readFile(path.join(artifactRoot, relative), "utf8"),
})));
const summary = {
  schemaVersion: "2.0.0",
  runId,
  sha,
  status: "pass",
  durationSeconds,
  evidenceHash: hashEvidenceFiles(evidence),
  evidenceFiles: evidencePaths,
};
await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
process.stdout.write(`SOTA harness PASS: ${sha} in ${durationSeconds}s, evidence ${summary.evidenceHash}.\n`);
