import { describe, expect, it } from "vitest";
import { evaluateChecklist, evaluateDelegation } from "../../scripts/governance-policy.mjs";

const head = "6668c6a3601a96c66c9f726143af41d362039b3e";
const record = {
  author: "joseangelo510", created_at: "2026-09-04T23:45:00Z",
  body: `Owner execution authorization
- Executed by: Codex
- Authorized by: Jose Gallegos (joseangelo510)
- Owner request: Fix the new dashboard navigation and remove mandatory Claude review.
- Authorization source: Codex task 01a05a31-2688-7392-97aa-c0f4af5ba02a, owner message dated 2026-09-04
- Authorized PR: 101
- Authorized head: ${head}
- Authorized actions: cto-approved, policy-change, merge`,
};

describe("owner-directed work without a mandatory external model", () => {
  it("accepts a transparent owner-authorized execution record without fabricating an OEA token", () => {
    expect(evaluateDelegation({ record, prNumber: 101, headSha: head, labels: ["cto-approved"], labelTimes: { "cto-approved": "2026-09-04T23:46:00Z" } })).toMatchObject({ mode: "delegated", errors: [] });
  });

  it("rejects wrong actors, missing owner evidence, stale heads, different PRs, and premature labels", () => {
    for (const changed of [
      { ...record, author: "someone-else" },
      { ...record, body: record.body.replace(/- Owner request:.*\n/, "") },
      { ...record, body: record.body.replace(/- Authorization source:.*\n/, "") },
      { ...record, body: record.body.replace(head, "0".repeat(40)) },
      { ...record, body: record.body.replace("Authorized PR: 101", "Authorized PR: 102") },
    ]) expect(evaluateDelegation({ record: changed, prNumber: 101, headSha: head }).errors.length).toBeGreaterThan(0);
    expect(evaluateDelegation({ record, prNumber: 101, headSha: head, labels: ["cto-approved"], labelTimes: { "cto-approved": "2026-09-04T23:44:00Z" } }).errors.length).toBeGreaterThan(0);
  });

  it("requires honestly attributed technical review at the exact head, not a Claude verdict", () => {
    const body = `
- [x] Classification: MEDIUM
- [x] Frozen zone: no frozen files or actions are touched
- [x] Vitest full suite green
  - Run: https://github.com/joseangelo510/destiny/actions/runs/123
- [x] ESLint, English-only rule, and file-length ratchet green
  - Run: https://github.com/joseangelo510/destiny/actions/runs/123
- [x] Playwright journeys green
  - Run: https://github.com/joseangelo510/destiny/actions/runs/123
- [x] Build stamp on staging matches this PR SHA
  - Evidence: ${head}
- [x] Touched staging routes checked with zero 5xx
- [x] Technical review completed at the current PR head
  - Reviewer: Codex
  - Verdict: GO
  - Reviewed head: ${head}
  - Reviewed on: 2026-09-04
`;
    expect(evaluateChecklist(body, { headSha: head }).errors).toEqual([]);
    for (const invalid of [body.replace("Reviewer: Codex", "Reviewer:"), body.replace("Verdict: GO", "Verdict: HOLD"), body.replace(`Reviewed head: ${head}`, `Reviewed head: ${"0".repeat(40)}`)]) {
      expect(evaluateChecklist(invalid, { headSha: head }).errors.length).toBeGreaterThan(0);
    }
  });
});
