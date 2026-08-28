import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { evaluateBuildWarnings } from "./harness/ratchet.mjs";

const productRoot = path.resolve(import.meta.dirname, "..");
const repositoryRoot = path.resolve(productRoot, "..");
const artifactRelative = "build/build.json";
const artifactPath = path.join(productRoot, "qa", "artifacts", "harness", artifactRelative);
const policyRelative = "qa/harness/build-warnings.v2.json";
const policy = JSON.parse(await readFile(path.join(productRoot, policyRelative), "utf8"));
const policySchema = JSON.parse(await readFile(path.join(productRoot, "qa/harness/build-warnings.schema.json"), "utf8"));
const receiptSchema = JSON.parse(await readFile(path.join(productRoot, "qa/harness/build-receipt.schema.json"), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
if (!ajv.validate(policySchema, policy)) throw new Error(`Build warning policy schema failure: ${ajv.errorsText(ajv.errors)}`);

function run(executable, args) {
  const result = spawnSync(executable, args, { cwd: productRoot, env: process.env, encoding: "utf8", maxBuffer: 100 * 1024 * 1024 });
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.error) throw result.error;
  return result;
}

const stamp = run(process.execPath, [path.join(productRoot, "scripts/write-build-stamp.mjs")]);
const command = ["next", "build", "--webpack"];
const build = stamp.status === 0
  ? run(path.join(productRoot, "node_modules", ".bin", "next"), ["build", "--webpack"])
  : { status: stamp.status, stdout: "", stderr: "" };
const output = `${build.stdout ?? ""}\n${build.stderr ?? ""}`;
const evaluation = evaluateBuildWarnings(output, policy);
const exitCode = build.status ?? 1;
const errors = [
  ...(stamp.status === 0 ? [] : [`Build-stamp command failed with status ${stamp.status ?? "unknown"}.`]),
  ...(exitCode === 0 ? [] : [`Production build failed with status ${exitCode}.`]),
  ...evaluation.errors,
];
const receipt = {
  schemaVersion: "2.0.0",
  sha: execFileSync("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot, encoding: "utf8" }).trim(),
  tree: execFileSync("git", ["rev-parse", "HEAD^{tree}"], { cwd: repositoryRoot, encoding: "utf8" }).trim(),
  checkedAt: new Date().toISOString(),
  command,
  exitCode,
  buildSucceeded: exitCode === 0,
  warningPolicy: policyRelative,
  matched: evaluation.matched,
  unknownWarnings: evaluation.unknownWarnings,
  errors,
};
const validateReceipt = ajv.compile(receiptSchema);
if (!validateReceipt(receipt)) throw new Error(`Build receipt schema failure: ${ajv.errorsText(validateReceipt.errors)}`);
await mkdir(path.dirname(artifactPath), { recursive: true });
await writeFile(artifactPath, `${JSON.stringify(receipt, null, 2)}\n`);
if (errors.length) {
  process.stderr.write(`Build evidence FAIL: ${errors.join(" ")} Receipt: ${artifactPath}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Build evidence PASS: ${evaluation.matched.length} known warning(s), zero new warnings.\n`);
}
