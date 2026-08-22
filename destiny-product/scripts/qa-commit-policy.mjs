import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(import.meta.dirname, "..");
const policyPath = path.join(root, "commit-policy.json");

function git(args) {
  return execFileSync("git", args, { cwd: path.resolve(root, ".."), encoding: "utf8" }).trim();
}

export function isTestFile(file) {
  return /(?:^|\/)[^/]+\.(?:test|spec)\.[cm]?[jt]sx?$/i.test(file);
}

export function validateCommitShape({ subject, files }) {
  const errors = [];
  const prefix = ["red:", "green:", "qa:", "test-change:"].find((candidate) => subject.startsWith(candidate));
  if (!prefix) return [`Commit subject must start with red:, green:, qa:, or test-change:: ${subject}`];
  const tests = files.filter((file) => isTestFile(file.path));
  const nonTests = files.filter((file) => !isTestFile(file.path));
  if (prefix === "green:" && tests.length) errors.push("A green: commit may not contain a test file.");
  if (prefix !== "green:" && nonTests.length) errors.push(`${prefix} commits may contain test files only.`);
  if ((prefix === "red:" || prefix === "qa:") && tests.some((file) => file.status !== "A")) {
    errors.push("Modified pre-existing tests require a justified test-change: commit.");
  }
  if (prefix === "test-change:" && !tests.some((file) => file.status === "M" || file.status === "R")) {
    errors.push("A test-change: commit must modify or rename at least one pre-existing test.");
  }
  if (tests.length && nonTests.length) errors.push("A commit may not mix test and production files.");
  return [...new Set(errors)];
}

const markerPatterns = [
  /\b(?:it|test|describe)\.(?:skip|only|todo)\s*\(/,
  /\b(?:xit|xtest|xdescribe)\s*\(/,
  /\b(?:fdescribe|fit)\s*\(/,
  /@pytest\.mark\.skip\b/,
];

export function findForbiddenTestMarkers(diff) {
  return diff.split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .filter((line) => markerPatterns.some((pattern) => pattern.test(line.slice(1))));
}

function changedFiles(commit) {
  return git(["diff-tree", "--no-commit-id", "--name-status", "-r", "--root", commit])
    .split("\n").filter(Boolean).map((line) => {
      const [status, ...parts] = line.split("\t");
      return { status: status[0], path: parts.at(-1) };
    });
}

async function main() {
  const policy = JSON.parse(await readFile(policyPath, "utf8"));
  if (!Number.isInteger(policy.policyVersion) || !/^[0-9a-f]{40}$/.test(policy.activationSha ?? "")) {
    throw new Error("commit-policy.json must contain policyVersion and a full activationSha.");
  }
  const introduction = git(["log", "--diff-filter=A", "--format=%H", "--", "destiny-product/commit-policy.json"])
    .split("\n").filter(Boolean).at(-1);
  if (!introduction) throw new Error("Git history does not contain commit-policy.json.");
  const introductionParent = git(["rev-parse", `${introduction}^`]);
  if (introductionParent !== policy.activationSha) {
    throw new Error("Policy activation SHA must be the parent of the commit that introduced commit-policy.json.");
  }
  const policyChanges = git(["log", "--format=%H", `${introduction}..HEAD`, "--", "destiny-product/commit-policy.json"])
    .split("\n").filter(Boolean);
  if (policyChanges.length) throw new Error("commit-policy.json is immutable after activation unless a future policy-version gate explicitly permits it.");

  const commits = git(["log", "--reverse", "--format=%H%x09%s", `${policy.activationSha}..HEAD`])
    .split("\n").filter(Boolean);
  const errors = [];
  for (const line of commits) {
    const separator = line.indexOf("\t");
    const sha = line.slice(0, separator);
    const subject = line.slice(separator + 1);
    for (const error of validateCommitShape({ subject, files: changedFiles(sha) })) errors.push(`${sha.slice(0, 12)}: ${error}`);
  }
  const testDiff = git(["diff", "--unified=0", `${policy.activationSha}..HEAD`, "--", "*.test.*", "*.spec.*"]);
  for (const marker of findForbiddenTestMarkers(testDiff)) errors.push(`Forbidden test marker added: ${marker}`);
  if (errors.length) {
    process.stderr.write(`${errors.join("\n")}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
