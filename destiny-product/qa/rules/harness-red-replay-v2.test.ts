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
      .toEqual(expect.objectContaining({ accepted: true, phase: "green" }));
    expect(classifyReplayAttempt({ exitCode: 1, output: "failure", plan, phase: "green" }))
      .toEqual(expect.objectContaining({ accepted: false, reason: "GREEN did not pass." }));
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
    expect(validateRedReplayPlan({
      ...plan, redCommit: "short", command: [], failurePattern: "", testFiles: [], implementationPaths: [],
    }, { isAncestor: true })).toEqual(expect.arrayContaining([
      "RED replay requires a full commit SHA.", "RED replay command must be an argv array.",
      "RED replay requires a failure pattern.", "RED replay requires test files.",
      "RED replay requires implementation paths.",
    ]));
    expect(classifyReplayAttempt({ exitCode: 1, output: "wrong failure", plan, phase: "red" }))
      .toEqual(expect.objectContaining({ accepted: false, reason: "RED failed for an undeclared reason." }));
    expect(classifyReplayAttempt({ exitCode: 0, output: "one passed", plan, phase: "blue" }))
      .toEqual(expect.objectContaining({ accepted: false, reason: "Unknown replay phase." }));
  });
});
