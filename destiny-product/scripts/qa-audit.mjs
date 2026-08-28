import { execFileSync, spawnSync } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { validateAuditExceptions } from "./harness/ratchet.mjs";

const productRoot = path.resolve(import.meta.dirname, "..");
const repositoryRoot = path.resolve(productRoot, "..");
const artifactRelative = "audit/exceptions.json";
const artifactPath = path.join(productRoot, "qa", "artifacts", "harness", artifactRelative);
const policyPath = path.join(productRoot, "qa", "harness", "audit-exceptions.v2.json");
const schemaPath = path.join(productRoot, "qa", "harness", "audit-exceptions.schema.json");
const workspace = await readFile(path.join(productRoot, "pnpm-workspace.yaml"), "utf8");
const ignoredGhsas = [...workspace.matchAll(/^\s+- (GHSA-[a-z0-9-]+)\s*$/gm)].map((match) => match[1]);
const policy = JSON.parse(await readFile(policyPath, "utf8"));
const schema = JSON.parse(await readFile(schemaPath, "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
const schemaValid = ajv.validate(schema, policy);
const testFiles = new Set();
for (const exception of policy.exceptions ?? []) {
  try {
    await access(path.join(productRoot, exception.boundaryTest));
    testFiles.add(exception.boundaryTest);
  } catch {
    // Semantic validation emits the stable missing-test error.
  }
}
const validationErrors = [
  ...(schemaValid ? [] : (ajv.errors ?? []).map((error) => `Audit exception schema ${error.instancePath || "/"} ${error.message}.`)),
  ...validateAuditExceptions(policy, { ignoredGhsas, testFiles }),
];
const receipt = {
  schemaVersion: "2.0.0",
  sha: execFileSync("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot, encoding: "utf8" }).trim(),
  checkedAt: new Date().toISOString(),
  ignoredGhsas,
  exceptions: policy.exceptions ?? [],
  validationErrors,
  auditExitCode: null,
};
await mkdir(path.dirname(artifactPath), { recursive: true });
await writeFile(artifactPath, `${JSON.stringify(receipt, null, 2)}\n`);
if (validationErrors.length) throw new Error(validationErrors.join("\n"));

const pnpmCli = process.env.npm_execpath;
const command = pnpmCli ? process.execPath : "pnpm";
const args = pnpmCli
  ? [pnpmCli, "audit", "--prod", "--audit-level=high"]
  : ["audit", "--prod", "--audit-level=high"];
const result = spawnSync(command, args, { stdio: "inherit" });

if (result.error) throw result.error;
receipt.auditExitCode = result.status ?? 1;
await writeFile(artifactPath, `${JSON.stringify(receipt, null, 2)}\n`);
process.exit(result.status ?? 1);
