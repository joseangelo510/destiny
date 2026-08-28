import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { evaluateEvidenceManifest, replayPlansFromManifest } from "./harness/evidence.mjs";
import { runRedReplay } from "./harness/red-replay.mjs";

const productRoot = path.resolve(import.meta.dirname, "..");
const repositoryRoot = path.resolve(productRoot, "..");
const manifestPath = path.join(repositoryRoot, ".github", "destiny-evidence.json");
const schemaPath = path.join(productRoot, "qa", "harness", "evidence.schema.json");
const artifactRoot = path.join(productRoot, "qa", "artifacts", "harness", "evidence");

function git(args) {
  return execFileSync("git", args, { cwd: repositoryRoot, encoding: "utf8" }).trim();
}

function protectedMainRef() {
  for (const candidate of ["origin/main", "github/main"]) {
    if (spawnSync("git", ["rev-parse", "--verify", "--quiet", candidate], { cwd: repositoryRoot }).status === 0) return candidate;
  }
  throw new Error("Typed evidence validation requires a canonical protected-main ref.");
}

function branchChanges(baseRef) {
  return git(["diff", "--name-only", `${baseRef}...HEAD`]).split("\n").filter(Boolean);
}

function isProtectedMainHead(baseRef) {
  return git(["rev-parse", "HEAD"]) === git(["rev-parse", baseRef]);
}

function productImplementationPaths(files) {
  return files.filter((file) => /^destiny-product\/src\//.test(file) && !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file)).sort();
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const schema = JSON.parse(await readFile(schemaPath, "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
const valid = ajv.validate(schema, manifest);
const baseRef = process.env.QA_BASE_REF || protectedMainRef();
const changedFiles = isProtectedMainHead(baseRef) ? [] : branchChanges(baseRef);
const subject = git(["log", "-1", "--format=%s"]);
const errors = [
  ...(valid ? [] : (ajv.errors ?? []).map((error) => `Evidence schema ${error.instancePath || "/"} ${error.message}.`)),
  ...evaluateEvidenceManifest(manifest, { changedFiles, isProtectedRevert: /^Revert\b/.test(subject) }),
];
const declaredProduct = [...manifest.productPaths].sort();
const actualProduct = productImplementationPaths(changedFiles);
if (JSON.stringify(declaredProduct) !== JSON.stringify(actualProduct)) {
  errors.push(`Evidence productPaths do not match the product diff. Declared=${JSON.stringify(declaredProduct)} actual=${JSON.stringify(actualProduct)}.`);
}

await mkdir(artifactRoot, { recursive: true });
const validation = {
  schemaVersion: "2.0.0",
  baseRef,
  head: git(["rev-parse", "HEAD"]),
  changedFiles,
  errors,
};
await writeFile(path.join(artifactRoot, "validation.json"), `${JSON.stringify(validation, null, 2)}\n`);
if (errors.length) throw new Error(errors.join("\n"));

if (!isProtectedMainHead(baseRef) && process.env.QA_SKIP_RED_REPLAY !== "1") {
  let index = 0;
  for (const plan of replayPlansFromManifest(manifest)) {
    if (plan.mode !== "required") continue;
    await runRedReplay({
      repositoryRoot,
      productRoot,
      plan,
      artifactDirectory: path.join(artifactRoot, `red-replay-${index}`),
      timeoutMs: 120_000,
    });
    index += 1;
  }
  if (index === 0 && manifest.redReplay.mode === "required") throw new Error("Required RED evidence produced no replay receipt.");
}

process.stdout.write(`Typed evidence PASS: ${changedFiles.length} changed files, ${replayPlansFromManifest(manifest).length} RED cycle(s).\n`);
