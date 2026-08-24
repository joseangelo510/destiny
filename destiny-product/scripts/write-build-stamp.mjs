import { execFileSync } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const productRoot = path.resolve(import.meta.dirname, "..");
const repositoryRoot = path.resolve(productRoot, "..");
const outputDirectory = path.join(productRoot, ".generated");
const outputPath = path.join(outputDirectory, "build-stamp.json");
const FULL_SHA = /^[0-9a-f]{40}$/;

function git(args) {
  try {
    return execFileSync("git", args, {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function gitIdentity() {
  const sha = git(["rev-parse", "HEAD"]);
  const tree = git(["rev-parse", "HEAD^{tree}"]);
  return FULL_SHA.test(sha ?? "") && FULL_SHA.test(tree ?? "")
    ? { sha, tree, source: "git" }
    : null;
}

async function fileIdentity() {
  try {
    const existing = JSON.parse(await readFile(outputPath, "utf8"));
    if (FULL_SHA.test(existing.sha ?? "") && FULL_SHA.test(existing.tree ?? "")) {
      return { sha: existing.sha, tree: existing.tree, source: "file" };
    }
  } catch {
    // A missing or invalid prior stamp falls through to the fail-closed identity.
  }
  return null;
}

function runtimeEnvironment() {
  if (process.env.DESTINY_RUNTIME_ENV?.trim()) return process.env.DESTINY_RUNTIME_ENV.trim();
  if (process.env.REPLIT_DEPLOYMENT) return "replit-production";
  if (process.env.NODE_ENV?.trim()) return process.env.NODE_ENV.trim();
  return "unknown";
}

const identity = gitIdentity() ?? await fileIdentity() ?? {
  sha: "unknown",
  tree: "unknown",
  source: "unknown",
};
const builtAt = new Date().toISOString();
let receipt = { ...identity, builtAt, env: runtimeEnvironment() };

try {
  await mkdir(outputDirectory, { recursive: true });
  const temporaryPath = `${outputPath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  await rename(temporaryPath, outputPath);
} catch (error) {
  receipt = { ...receipt, sha: "unknown", tree: "unknown", source: "unknown" };
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Build provenance could not be written: ${message}\n`);
}

process.stdout.write(
  `build-stamp: sha=${receipt.sha} tree=${receipt.tree} builtAt=${receipt.builtAt} source=${receipt.source} cwd=${productRoot}\n`,
);
process.exitCode = 0;
