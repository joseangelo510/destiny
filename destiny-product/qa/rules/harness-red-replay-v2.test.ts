import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
async function loadReplayModule() {
  const modulePath = "../../scripts/harness/" + "red-replay.mjs";
  return import(/* @vite-ignore */ modulePath);
}

describe("mechanically replayed RED and GREEN evidence", () => {
  const plan = {
    mode: "required",
    redCommit: "a".repeat(40),
    command: ["pnpm", "vitest", "run", "qa/rules/example.test.ts"],
    failurePattern: "expected failure",
    testFiles: ["destiny-product/qa/rules/example.test.ts"],
    implementationPaths: ["destiny-product/scripts/harness/example.mjs"],
  };

  it("rejects shell evaluation, invalid ancestry, broad commands, and zero-test output", async () => {
    const { classifyReplayAttempt, validateRedReplayPlan } = await loadReplayModule();
    expect(validateRedReplayPlan(plan, { isAncestor: true })).toEqual([]);
    expect(validateRedReplayPlan({ ...plan, command: ["sh", "-c", "pnpm test"] }, { isAncestor: true }))
      .toContain("RED replay commands may not invoke a shell.");
    expect(validateRedReplayPlan({ ...plan, command: ["pnpm", "test"] }, { isAncestor: true }))
      .toContain("RED replay must use a focused test command.");
    expect(validateRedReplayPlan(plan, { isAncestor: false }))
      .toContain("The declared RED commit is not an ancestor of HEAD.");
    expect(classifyReplayAttempt({ exitCode: 1, output: "No test files found", plan, phase: "red" }))
      .toEqual(expect.objectContaining({ accepted: false, reason: "RED collected zero tests." }));
    for (const shell of ["bash", "cmd", "dash", "fish", "powershell", "pwsh", "sh", "zsh"]) {
      expect(validateRedReplayPlan({ ...plan, command: [`/bin/${shell.toUpperCase()}`, "script"] }, { isAncestor: true }))
        .toContain("RED replay commands may not invoke a shell.");
    }
    expect(validateRedReplayPlan({ ...plan, command: ["pnpm", "-c", "safe"] }, { isAncestor: true }))
      .toContain("RED replay commands may not invoke a shell.");
    expect(validateRedReplayPlan({ ...plan, command: ["pnpm", ""] }, { isAncestor: true })).toEqual([
      "RED replay must use a focused test command.",
    ]);
    expect(validateRedReplayPlan({
      ...plan,
      testFiles: [plan.testFiles[0], "destiny-product/qa/rules/missing.test.ts"],
    }, { isAncestor: true })).toContain("RED replay must use a focused test command.");
    expect(validateRedReplayPlan({
      ...plan,
      command: ["pnpm", `prefix/${plan.testFiles[0].replace(/^destiny-product\//, "")}`],
    }, { isAncestor: true })).toEqual([]);
    expect(validateRedReplayPlan({
      ...plan,
      command: ["pnpm", `prefix/${plan.testFiles[0].replace(/^destiny-product\//, "")}`],
      testFiles: [`prefix/${plan.testFiles[0]}`],
    }, { isAncestor: true })).toContain("RED replay must use a focused test command.");
  });

  it("accepts only the declared RED failure and a clean GREEN pass", async () => {
    const { classifyReplayAttempt } = await loadReplayModule();
    expect(classifyReplayAttempt({
      exitCode: 1,
      output: "1 test failed: expected failure",
      plan,
      phase: "red",
    })).toEqual(expect.objectContaining({ accepted: true, phase: "red" }));
    expect(classifyReplayAttempt({ exitCode: 0, output: "1 test passed", plan, phase: "red" }))
      .toEqual(expect.objectContaining({ accepted: false, reason: "RED unexpectedly passed." }));
    expect(classifyReplayAttempt({ exitCode: 0, output: "1 test passed", plan, phase: "green" }))
      .toEqual({ accepted: true, phase: "green", reason: "GREEN passed." });
    expect(classifyReplayAttempt({ exitCode: 1, output: "failure", plan, phase: "green" }))
      .toEqual(expect.objectContaining({ accepted: false, reason: "GREEN did not pass." }));
    expect(classifyReplayAttempt({ exitCode: 1, output: "failure", plan, phase: "blue" }))
      .toEqual({ accepted: false, phase: "blue", reason: "Unknown replay phase." });
    expect(classifyReplayAttempt({ exitCode: 1, plan: { ...plan, failurePattern: "Stryker was here!" }, phase: "red" }))
      .toEqual({ accepted: false, phase: "red", reason: "RED failed for an undeclared reason." });
  });

  it("proves implementation paths were absent or unchanged at RED", async () => {
    const { verifyImplementationWasAbsentAtRed } = await loadReplayModule();
    expect(verifyImplementationWasAbsentAtRed(plan.implementationPaths, {
      redFiles: new Map(),
      headFiles: new Map([[plan.implementationPaths[0], "new implementation"]]),
    })).toEqual([]);
    expect(verifyImplementationWasAbsentAtRed(plan.implementationPaths, {
      redFiles: new Map([[plan.implementationPaths[0], "already implemented"]]),
      headFiles: new Map([[plan.implementationPaths[0], "already implemented"]]),
    })).toEqual(expect.arrayContaining([
      expect.stringContaining("was already identical at RED"),
    ]));
    expect(verifyImplementationWasAbsentAtRed(plan.implementationPaths, {
      redFiles: new Map(),
      headFiles: new Map(),
    })).toEqual([`${plan.implementationPaths[0]} is not present at HEAD.`]);
  });

  it("fails closed for malformed declarations and unknown phases", async () => {
    const { classifyReplayAttempt, validateRedReplayPlan } = await loadReplayModule();
    expect(validateRedReplayPlan(null, { isAncestor: true })).toEqual(["RED replay plan must use required mode."]);
    expect(validateRedReplayPlan({ ...plan, mode: "not-required" }, { isAncestor: true }))
      .toEqual(["RED replay plan must use required mode."]);
    for (const redCommit of [`x${"a".repeat(40)}`, `${"a".repeat(40)}x`]) {
      expect(validateRedReplayPlan({ ...plan, redCommit }, { isAncestor: true }))
        .toContain("RED replay requires a full commit SHA.");
    }
    expect(validateRedReplayPlan({
      ...plan, redCommit: "short", command: [], failurePattern: "", testFiles: [], implementationPaths: [],
    }, { isAncestor: true })).toEqual(expect.arrayContaining([
      "RED replay requires a full commit SHA.", "RED replay command must be an argv array.",
      "RED replay requires a failure pattern.", "RED replay requires test files.",
      "RED replay requires implementation paths.",
    ]));
    const withoutOptionalFields = { ...plan } as Partial<typeof plan>;
    delete withoutOptionalFields.redCommit;
    delete withoutOptionalFields.testFiles;
    expect(validateRedReplayPlan(withoutOptionalFields, { isAncestor: true })).toEqual([
      "RED replay requires a full commit SHA.",
      "RED replay requires test files.",
    ]);
    expect(classifyReplayAttempt({ exitCode: 1, output: "wrong failure", plan, phase: "red" }))
      .toEqual(expect.objectContaining({ accepted: false, reason: "RED failed for an undeclared reason." }));
    expect(classifyReplayAttempt({ exitCode: 0, output: "one passed", plan, phase: "blue" }))
      .toEqual(expect.objectContaining({ accepted: false, reason: "Unknown replay phase." }));
  });

  it("does not misclassify double-digit test totals as zero tests", async () => {
    const { classifyReplayAttempt } = await loadReplayModule();
    expect(classifyReplayAttempt({
      exitCode: 1,
      output: "quality-v2.test.ts (10 tests | 3 failed) validateJourneyRegistry is not a function",
      plan: { ...plan, failurePattern: "validateJourneyRegistry is not a function" },
      phase: "red",
    })).toEqual(expect.objectContaining({
      accepted: true,
      reason: "RED failed for the declared reason.",
    }));
    for (const output of ["tests\nno tests", "tests  \n no tests", "0 test", "0 tests"]) {
      expect(classifyReplayAttempt({ exitCode: 1, output, plan, phase: "red" }))
        .toEqual(expect.objectContaining({ accepted: false, reason: "RED collected zero tests." }));
    }
  });

  it("documents only behaviorally equivalent Node plumbing mutations", async () => {
    const source = await readFile(path.join(process.cwd(), "scripts/harness/red-replay.mjs"), "utf8");
    expect(source).toContain("invalid sentinel cannot satisfy the SHA validator");
    expect(source).toContain("absent file helper returns undefined");
    expect(source).toContain("Node process option variants are behaviorally equivalent");
    expect(source).toContain("temporary-path label does not affect isolation");
    expect(source).toContain("cleanup target exists before forced removal");
    expect(source).toContain("JSON parsing accepts Buffer and UTF-8 text");
    expect(source).toContain("absent RED entries remain distinguishable by undefined content");
  });

  it("executes and cleans up real detached RED and GREEN worktrees", async () => {
    const { readReplayPlan, runRedReplay } = await loadReplayModule();
    const repositoryRoot = await mkdtemp(path.join(tmpdir(), "destiny-replay-test-"));
    const productRoot = path.join(repositoryRoot, "destiny-product");
    const artifactDirectory = path.join(repositoryRoot, "artifacts", "nested");
    const git = (...args: string[]) => execFileSync("git", args, { cwd: repositoryRoot, encoding: "utf8" }).trim();
    try {
      await mkdir(productRoot, { recursive: true });
      await writeFile(path.join(productRoot, "implementation.txt"), "red\n");
      await writeFile(path.join(productRoot, "unchanged.txt"), "same\n");
      git("init", "--quiet");
      git("config", "user.email", "harness@example.invalid");
      git("config", "user.name", "Harness Test");
      git("add", ".");
      git("commit", "--quiet", "-m", "red fixture");
      const redCommit = git("rev-parse", "HEAD");
      await writeFile(path.join(productRoot, "implementation.txt"), "green\n");
      await writeFile(path.join(productRoot, "added-at-green.txt"), "new\n");
      git("add", ".");
      git("commit", "--quiet", "-m", "green fixture");
      const greenCommit = git("rev-parse", "HEAD");
      await mkdir(path.join(productRoot, "node_modules"), { recursive: true });
      await writeFile(path.join(productRoot, "node_modules", "harness-marker.txt"), "linked\n");
      const command = [
        process.execPath,
        "-e",
        "const fs=require('node:fs');if(process.env.QA_NETWORK_MODE!=='mocked'||!process.env.PATH)process.exit(2);if(fs.readFileSync('node_modules/harness-marker.txt','utf8').trim()!=='linked')process.exit(3);const value=fs.readFileSync('implementation.txt','utf8').trim();if(value==='red'){console.error('expected fixture failure');process.exit(1)}console.log('1 test passed')",
        "qa/rules/example.test.ts",
      ];
      const fixturePlan = {
        ...plan,
        redCommit,
        command,
        failurePattern: "expected fixture failure",
        implementationPaths: [
          "destiny-product/implementation.txt",
          "destiny-product/added-at-green.txt",
        ],
      };
      const planFile = path.join(repositoryRoot, "plan.json");
      await writeFile(planFile, JSON.stringify({ redReplay: fixturePlan }));
      await expect(readReplayPlan(planFile)).resolves.toEqual(fixturePlan);

      const receipts = await runRedReplay({
        repositoryRoot,
        productRoot,
        plan: fixturePlan,
        artifactDirectory,
        timeoutMs: 10_000,
      });
      expect(receipts.red.verdict).toEqual(expect.objectContaining({ accepted: true }));
      expect(receipts.green.verdict).toEqual(expect.objectContaining({ accepted: true }));
      await expect(readFile(path.join(artifactDirectory, "red-replay.json"), "utf8"))
        .resolves.toContain('"schemaVersion": "2.0.0"');
      expect(git("worktree", "list", "--porcelain")).not.toContain("destiny-red-replay-");

      await expect(runRedReplay({
        repositoryRoot,
        productRoot,
        plan: { ...fixturePlan, redCommit: "0".repeat(40) },
        headCommit: greenCommit,
        artifactDirectory: path.join(repositoryRoot, "non-ancestor-artifacts"),
      })).rejects.toThrow("The declared RED commit is not an ancestor of HEAD.");
      await expect(runRedReplay({
        repositoryRoot,
        productRoot,
        plan: {
          ...fixturePlan,
          redCommit: "short",
          command: [],
          failurePattern: "",
          testFiles: [],
          implementationPaths: [],
        },
        headCommit: greenCommit,
        artifactDirectory: path.join(repositoryRoot, "multi-invalid-artifacts"),
      })).rejects.toThrow([
        "RED replay requires a full commit SHA.",
        "The declared RED commit is not an ancestor of HEAD.",
        "RED replay command must be an argv array.",
        "RED replay requires a failure pattern.",
        "RED replay requires test files.",
        "RED replay requires implementation paths.",
      ].join("\n"));
      await expect(runRedReplay({
        repositoryRoot,
        productRoot,
        plan: { ...fixturePlan, implementationPaths: [
          "destiny-product/missing-one.txt",
          "destiny-product/missing-two.txt",
        ] },
        headCommit: greenCommit,
        artifactDirectory: path.join(repositoryRoot, "multi-missing-artifacts"),
      })).rejects.toThrow("destiny-product/missing-one.txt is not present at HEAD.\ndestiny-product/missing-two.txt is not present at HEAD.");
      await expect(runRedReplay({
        repositoryRoot,
        productRoot,
        plan: { ...fixturePlan, implementationPaths: ["destiny-product/unchanged.txt"] },
        headCommit: greenCommit,
        artifactDirectory: path.join(repositoryRoot, "unchanged-artifacts"),
      })).rejects.toThrow("destiny-product/unchanged.txt was already identical at RED.");

      await expect(runRedReplay({
        repositoryRoot,
        productRoot,
        plan: { ...fixturePlan, redCommit: "short" },
        headCommit: greenCommit,
        artifactDirectory: path.join(repositoryRoot, "invalid-plan-artifacts"),
      })).rejects.toThrow("RED replay requires a full commit SHA.");
      await expect(runRedReplay({
        repositoryRoot,
        productRoot,
        plan: { ...fixturePlan, implementationPaths: ["destiny-product/missing-at-head.txt"] },
        headCommit: greenCommit,
        artifactDirectory: path.join(repositoryRoot, "missing-implementation-artifacts"),
      })).rejects.toThrow("destiny-product/missing-at-head.txt is not present at HEAD.");

      await expect(runRedReplay({
        repositoryRoot,
        productRoot,
        plan: {
          ...fixturePlan,
          command: ["definitely-missing-harness-command", "qa/rules/example.test.ts"],
        },
        headCommit: greenCommit,
        artifactDirectory: path.join(repositoryRoot, "missing-command-artifacts"),
        timeoutMs: 1_000,
      })).rejects.toThrow("RED/GREEN replay did not satisfy the evidence contract.");
      const missingCommandReceipt = JSON.parse(await readFile(
        path.join(repositoryRoot, "missing-command-artifacts", "red-replay.json"), "utf8",
      ));
      expect(missingCommandReceipt.red).toEqual(expect.objectContaining({ exitCode: 1, output: "" }));

      await expect(runRedReplay({
        repositoryRoot,
        productRoot,
        plan: {
          ...fixturePlan,
          command: [
            process.execPath,
            "-e",
            "console.error('expected fixture failure');process.exit(1)",
            "qa/rules/example.test.ts",
          ],
        },
        headCommit: greenCommit,
        artifactDirectory: path.join(repositoryRoot, "failed-artifacts"),
        timeoutMs: 10_000,
      })).rejects.toThrow("RED/GREEN replay did not satisfy the evidence contract.");
      expect(git("worktree", "list", "--porcelain")).not.toContain("destiny-red-replay-");
    } finally {
      await rm(repositoryRoot, { recursive: true, force: true });
    }
  }, 30_000);
});
