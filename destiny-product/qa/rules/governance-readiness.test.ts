import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { evaluateReadiness, checkPayload, verifyEvidenceRuns } from "../../scripts/governance-readiness.mjs";
import { validatePreflight } from "../../scripts/pr-preflight.mjs";

const head = "a".repeat(40);
const run = (path: string, id: number, extra = {}) => ({ id, path, head_sha: head, event: "pull_request", status: "completed", conclusion: "success", ...extra });
const runs = [run(".github/workflows/ci.yml", 1), run(".github/workflows/staging-evidence.yml", 2)];
const body = `
- [x] Classification: MEDIUM
- [x] Frozen zone: no frozen files or actions are touched
- [x] Vitest full suite green
  - Run: https://github.com/joseangelo510/destiny/actions/runs/1
- [x] ESLint, English-only rule, and file-length ratchet green
  - Run: https://github.com/joseangelo510/destiny/actions/runs/1
- [x] Playwright journeys green
  - Run: https://github.com/joseangelo510/destiny/actions/runs/1
- [x] Build stamp on staging matches this PR SHA
  - Evidence: ${head} https://github.com/joseangelo510/destiny/actions/runs/2
- [x] Touched staging routes checked with zero 5xx
- [x] Technical review completed at the current PR head
  - Reviewer: Codex
  - Verdict: GO
  - Reviewed head: ${head}
  - Reviewed on: 2026-09-05
`;
const context = { files: [], labels: [], labelActors: {}, headSha: head, body, runs, draft: false };

describe("merge-blocking readiness", () => {
  it("waits on missing owner approval and fails forged approval", () => {
    expect(evaluateReadiness("policy", { ...context, files: ["HARNESS_POLICY.md"] }).state).toBe("waiting");
    expect(evaluateReadiness("policy", { ...context, files: ["HARNESS_POLICY.md"], labels: ["cto-approved"], labelActors: { "cto-approved": "someone-else" } }).state).toBe("failure");
  });
  it("requires complete, current, attributed evidence even if claimed ready", () => {
    expect(evaluateReadiness("checklist", context).state).toBe("success");
    for (const patch of [{ body: "" }, { body: body.replace(head, "b".repeat(40)) }, { body: body.replace("Verdict: GO", "Verdict: HOLD") }, { draft: true }, { runs: [] }]) {
      expect(evaluateReadiness("checklist", { ...context, ...patch }).state).toBe("waiting");
    }
  });
  it("requires actual latest successful head-bound harness and staging runs", () => {
    for (const change of [{ conclusion: "failure" }, { conclusion: "cancelled" }, { conclusion: "skipped" }, { head_sha: "b".repeat(40) }, { event: "push" }, { status: "in_progress", conclusion: null }]) {
      expect(verifyEvidenceRuns(body, head, [runs[0], { ...runs[1], ...change }]).length).toBeGreaterThan(0);
    }
    expect(verifyEvidenceRuns(body, head, [...runs, run(".github/workflows/staging-evidence.yml", 3, { conclusion: "failure" })]).length).toBeGreaterThan(0);
    expect(verifyEvidenceRuns(body.replaceAll("runs/1", "runs/999"), head, runs).length).toBeGreaterThan(0);
  });
  it("never reports success, skipped or neutral for unmet requirements", () => {
    expect(checkPayload("checklist", head, { state: "waiting", reasons: ["Awaiting review"] })).toMatchObject({ name: "checklist-guard", head_sha: head, status: "in_progress" });
    expect(checkPayload("policy", head, { state: "waiting", reasons: [] })).not.toHaveProperty("conclusion");
    expect(checkPayload("policy", head, { state: "failure", reasons: ["Invalid authority"] })).toMatchObject({ conclusion: "failure" });
  });
  it("preflights generated inventory drift and exact evidence formatting", () => {
    expect(validatePreflight({ body, headSha: head, inventoryDirty: false })).toEqual([]);
    expect(validatePreflight({ body, headSha: head, inventoryDirty: true })).toContain("Generated QA inventory differs from the committed inventory.");
    expect(validatePreflight({ body: body.replace(`Evidence: ${head}`, "Evidence: omitted"), headSha: head, inventoryDirty: false })).toContain("Build-stamp evidence must include the full 40-character PR SHA.");
  });
  it("uses trusted source with serialized refreshes and keeps all code-head validation", () => {
    for (const name of ["policy", "checklist"]) {
      const workflow = readFileSync(`../.github/workflows/${name}-guard.yml`, "utf8");
      expect(workflow).toContain("pull_request_target:");
      expect(workflow).not.toMatch(/^  pull_request:/m);
      expect(workflow).toContain("persist-credentials: false");
      expect(workflow).not.toContain("ref: ${{ github.event.pull_request.head.sha }}");
      expect(workflow).toContain("cancel-in-progress: false");
      expect(workflow).not.toContain(`name: ${name}-guard\n    runs-on`);
      expect(workflow).toContain("issue_comment:");
      expect(workflow).toContain("workflow_dispatch:");
      expect(workflow).toContain("types: [requested, in_progress, completed]");
    }
    const staging = readFileSync("../.github/workflows/staging-evidence.yml", "utf8");
    expect(staging).toContain("types: [opened, synchronize, reopened]");
    expect(staging).not.toContain("reopened, edited");
  });
});
