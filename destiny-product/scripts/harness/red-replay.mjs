import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const SHELL_COMMANDS = new Set(["bash", "cmd", "dash", "fish", "powershell", "pwsh", "sh", "zsh"]);
const ZERO_TEST = /(?:no test files found|no tests found|tests\s+no tests|\b0 tests?\b)/i;

export function validateRedReplayPlan(plan, { isAncestor }) {
  const errors = [];
  if (!plan || plan.mode !== "required") return ["RED replay plan must use required mode."];
  // Stryker disable next-line StringLiteral: an invalid sentinel cannot satisfy the SHA validator
  if (!/^[0-9a-f]{40}$/.test(plan.redCommit ?? "")) errors.push("RED replay requires a full commit SHA.");
  if (!isAncestor) errors.push("The declared RED commit is not an ancestor of HEAD.");
  if (!Array.isArray(plan.command) || plan.command.length < 2) errors.push("RED replay command must be an argv array.");
  else {
    if (SHELL_COMMANDS.has(path.basename(plan.command[0]).toLowerCase()) || plan.command.includes("-c")) {
      errors.push("RED replay commands may not invoke a shell.");
    }
    const focused = (plan.testFiles ?? []).every((file) => plan.command.some((argument) => argument.endsWith(file.replace(/^destiny-product\//, ""))));
    if (!focused) errors.push("RED replay must use a focused test command.");
  }
  if (!plan.failurePattern) errors.push("RED replay requires a failure pattern.");
  if (!Array.isArray(plan.testFiles) || plan.testFiles.length === 0) errors.push("RED replay requires test files.");
  if (!Array.isArray(plan.implementationPaths) || plan.implementationPaths.length === 0) errors.push("RED replay requires implementation paths.");
  return [...new Set(errors)];
}

export function classifyReplayAttempt({ exitCode, output = "", plan, phase }) {
  if (ZERO_TEST.test(output)) return { accepted: false, phase, reason: `${phase.toUpperCase()} collected zero tests.` };
  if (phase === "red") {
    if (exitCode === 0) return { accepted: false, phase, reason: "RED unexpectedly passed." };
    if (!output.includes(plan.failurePattern)) return { accepted: false, phase, reason: "RED failed for an undeclared reason." };
    return { accepted: true, phase, reason: "RED failed for the declared reason." };
  }
  if (phase === "green" && exitCode !== 0) return { accepted: false, phase, reason: "GREEN did not pass." };
  if (phase === "green") return { accepted: true, phase, reason: "GREEN passed." };
  return { accepted: false, phase, reason: "Unknown replay phase." };
}

export function verifyImplementationWasAbsentAtRed(paths, { redFiles, headFiles }) {
  const errors = [];
  for (const file of paths) {
    if (!headFiles.has(file)) errors.push(`${file} is not present at HEAD.`);
    else if (redFiles.has(file) && redFiles.get(file) === headFiles.get(file)) errors.push(`${file} was already identical at RED.`);
  }
  return errors;
}

function git(repositoryRoot, args, options = {}) {
  return execFileSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    // Stryker disable next-line ArrayDeclaration,StringLiteral: Node process option variants are behaviorally equivalent when stdout is piped and stderr is intentionally discarded
    stdio: ["ignore", "pipe", "ignore"],
    ...options,
  }).trim();
}

function fileAt(repositoryRoot, sha, file) {
  try {
    return git(repositoryRoot, ["show", `${sha}:${file}`]);
  } catch {
    // The absent file helper returns undefined through normal function completion.
  }
}

async function runInWorktree({ command, directory, timeoutMs }) {
  const result = spawnSync(command[0], command.slice(1), {
    cwd: path.join(directory, "destiny-product"),
    // Stryker disable next-line StringLiteral: Node process option variants are behaviorally equivalent because receipt interpolation normalizes Buffer and text output
    encoding: "utf8",
    env: { ...process.env, QA_NETWORK_MODE: "mocked" },
    shell: false,
    timeout: timeoutMs,
  });
  return {
    exitCode: result.status ?? 1,
    output: `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim(),
    signal: result.signal,
  };
}

export async function runRedReplay({ repositoryRoot, productRoot, plan, headCommit = "HEAD", artifactDirectory, timeoutMs = 120_000 }) {
  const headSha = git(repositoryRoot, ["rev-parse", headCommit]);
  const ancestor = spawnSync("git", ["merge-base", "--is-ancestor", plan.redCommit, headSha], { cwd: repositoryRoot }).status === 0;
  const planErrors = validateRedReplayPlan(plan, { isAncestor: ancestor });
  if (planErrors.length) throw new Error(planErrors.join("\n"));
  const redFiles = new Map(plan.implementationPaths.flatMap((file) => {
    const contents = fileAt(repositoryRoot, plan.redCommit, file);
    return contents === undefined ? [] : [[file, contents]];
  }));
  const headFiles = new Map(plan.implementationPaths.flatMap((file) => {
    const contents = fileAt(repositoryRoot, headSha, file);
    return contents === undefined ? [] : [[file, contents]];
  }));
  const implementationErrors = verifyImplementationWasAbsentAtRed(plan.implementationPaths, { redFiles, headFiles });
  if (implementationErrors.length) throw new Error(implementationErrors.join("\n"));

  // Stryker disable next-line StringLiteral: the temporary-path label does not affect isolation
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "destiny-red-replay-"));
  const redDirectory = path.join(temporaryRoot, "red");
  const greenDirectory = path.join(temporaryRoot, "green");
  await mkdir(artifactDirectory, { recursive: true });
  try {
    git(repositoryRoot, ["worktree", "add", "--detach", redDirectory, plan.redCommit]);
    git(repositoryRoot, ["worktree", "add", "--detach", greenDirectory, headSha]);
    await symlink(path.join(productRoot, "node_modules"), path.join(redDirectory, "destiny-product", "node_modules"), "dir");
    await symlink(path.join(productRoot, "node_modules"), path.join(greenDirectory, "destiny-product", "node_modules"), "dir");
    const red = await runInWorktree({ command: plan.command, directory: redDirectory, timeoutMs });
    const green = await runInWorktree({ command: plan.command, directory: greenDirectory, timeoutMs });
    const receipts = {
      schemaVersion: "2.0.0",
      red: { ...red, commit: plan.redCommit, verdict: classifyReplayAttempt({ ...red, plan, phase: "red" }) },
      green: { ...green, commit: headSha, verdict: classifyReplayAttempt({ ...green, plan, phase: "green" }) },
    };
    await writeFile(path.join(artifactDirectory, "red-replay.json"), `${JSON.stringify(receipts, null, 2)}\n`);
    if (!receipts.red.verdict.accepted || !receipts.green.verdict.accepted) throw new Error("RED/GREEN replay did not satisfy the evidence contract.");
    return receipts;
  } finally {
    for (const directory of [redDirectory, greenDirectory]) {
      spawnSync("git", ["worktree", "remove", "--force", directory], { cwd: repositoryRoot });
    }
    // Stryker disable next-line BooleanLiteral: the cleanup target exists before forced removal
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

export async function readReplayPlan(file) {
  // Stryker disable next-line StringLiteral: JSON parsing accepts Buffer and UTF-8 text equivalently
  return JSON.parse(await readFile(file, "utf8")).redReplay;
}
