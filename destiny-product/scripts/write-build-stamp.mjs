import { execFileSync } from "node:child_process";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const productRoot = path.resolve(import.meta.dirname, "..");
const repositoryRoot = path.resolve(productRoot, "..");
const outputDirectory = path.join(productRoot, ".generated");
const outputPath = path.join(outputDirectory, "build-stamp.json");

function git(args) {
  try {
    return execFileSync("git", args, {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}

function runtimeEnvironment() {
  if (process.env.DESTINY_RUNTIME_ENV?.trim()) return process.env.DESTINY_RUNTIME_ENV.trim();
  if (process.env.REPLIT_DEPLOYMENT) return "replit-production";
  if (process.env.NODE_ENV?.trim()) return process.env.NODE_ENV.trim();
  return "unknown";
}

const stamp = {
  sha: git(["rev-parse", "HEAD"]),
  tree: git(["rev-parse", "HEAD^{tree}"]),
  builtAt: new Date().toISOString(),
  env: runtimeEnvironment(),
};

await mkdir(outputDirectory, { recursive: true });
const temporaryPath = `${outputPath}.${process.pid}.tmp`;
await writeFile(temporaryPath, `${JSON.stringify(stamp, null, 2)}\n`, "utf8");
await rename(temporaryPath, outputPath);
process.stdout.write(`Destiny build provenance written for ${stamp.sha}.\n`);

