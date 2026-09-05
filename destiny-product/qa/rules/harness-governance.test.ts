import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  classifyGovernanceChange,
  compareDependencyManifests,
  evaluateChecklist,
  evaluateDelegation,
  evaluateTechnicalReview,
  evaluatePolicyGuard,
  parseOwnerExecutionAuthorization,
} from "../../scripts/governance-policy.mjs";

const prHead = "6668c6a3601a96c66c9f726143af41d362039b3e";
const staleHead = "0123456789abcdef0123456789abcdef01234567";

const productRoot = process.cwd();
const repositoryRoot = path.resolve(productRoot, "..");

async function exists(relativePath: string) {
  try {
    await access(path.join(repositoryRoot, relativePath));
    return true;
  } catch {
    return false;
  }
}

const completeMediumBody = `
## Governance classification

- [x] Classification: MEDIUM
- [x] Classification recorded before implementation
  - Confirmed on: 2026-09-04 at base: 77b0e0d002f6acda2168e438f99c9fb01d5bc767
- [x] Frozen zone: no frozen files or actions are touched

## Harness evidence

- [x] Vitest full suite green
  - Run: https://github.com/joseangelo510/destiny/actions/runs/123
- [x] ESLint, English-only rule, and file-length ratchet green
  - Run: https://github.com/joseangelo510/destiny/actions/runs/123
- [x] Playwright journeys green
  - Run: https://github.com/joseangelo510/destiny/actions/runs/123
- [x] Build stamp on staging matches this PR SHA
  - Evidence: sha=${prHead}
- [x] Touched staging routes checked with zero 5xx
  - Evidence: /this-week=200

## Technical review

- [x] Technical review completed at the current PR head
  - Reviewer: Codex
  - Verdict: GO
  - Reviewed head: ${prHead}
  - Reviewed on: 2026-09-04
  - Record: pasted below
`;

describe("Destiny GOV-1 harness governance", () => {
  it("classifies ordinary work as MEDIUM and frozen surfaces as HIGH", () => {
    expect(classifyGovernanceChange(["destiny-product/src/app/this-week/page.tsx"]).level).toBe("MEDIUM");
    expect(classifyGovernanceChange(["destiny-product/src/app/globals.css"]).level).toBe("MEDIUM");
    expect(classifyGovernanceChange(["destiny-product/qa/rules/new.test.ts"]).level).toBe("MEDIUM");

    for (const frozen of [
      "HARNESS_POLICY.md",
      "destiny-product/qa/rules/governance-readiness.test.ts",
      "destiny-product/qa/rules/governance-refresh.test.ts",
      "destiny-product/qa/rules/staging-evidence-policy.test.ts",
      "AGENTS.md",
      "CLAUDE.md",
      ".github/workflows/policy-guard.yml",
      ".github/scripts/governance-policy.mjs",
      ".claude/skills/destiny-harness/SKILL.md",
      "destiny-product/supabase/config.toml",
      "destiny-product/supabase/migrations/20260823000000_example.sql",
      "destiny-product/supabase/functions/google-oauth-start/index.ts",
      "production/run.json",
      "Dockerfile",
      "fly.toml",
    ]) {
      const decision = classifyGovernanceChange([frozen]);
      expect(decision.level, frozen).toBe("HIGH");
      expect(decision.reasons.length, frozen).toBeGreaterThan(0);
    }
  });

  it("blocks frozen paths unless Jose supplied both required approval labels", () => {
    const unapproved = evaluatePolicyGuard({
      files: ["destiny-product/supabase/migrations/20260823000000_example.sql"],
      labels: [],
      labelActors: {},
    });
    expect(unapproved.errors).toEqual(expect.arrayContaining([expect.stringMatching(/cto-approved/i)]));

    const wrongActor = evaluatePolicyGuard({
      files: ["HARNESS_POLICY.md"],
      labels: ["cto-approved", "policy-change"],
      labelActors: { "cto-approved": "codex", "policy-change": "joseangelo510" },
    });
    expect(wrongActor.errors).toEqual(expect.arrayContaining([expect.stringMatching(/joseangelo510/i)]));

    const approved = evaluatePolicyGuard({
      files: ["HARNESS_POLICY.md"],
      labels: ["cto-approved", "policy-change"],
      labelActors: { "cto-approved": "joseangelo510", "policy-change": "joseangelo510" },
    });
    expect(approved.errors).toEqual([]);
  });

  it("keeps ordinary dependency updates MEDIUM and escalates risky updates", () => {
    expect(compareDependencyManifests(
      { dependencies: { zod: "^4.1.0" } },
      { dependencies: { zod: "^4.2.0" } },
    )).toEqual({ high: false, reasons: [] });

    for (const [before, after] of [
      [{ dependencies: { zod: "^4.1.0" } }, { dependencies: { zod: "^5.0.0" } }],
      [{ dependencies: {} }, { dependencies: { zod: "^4.2.0" } }],
      [{ dependencies: { "@supabase/supabase-js": "^2.111.0" } }, { dependencies: { "@supabase/supabase-js": "^2.112.0" } }],
    ]) {
      const decision = compareDependencyManifests(before, after);
      expect(decision.high).toBe(true);
      expect(decision.reasons.length).toBeGreaterThan(0);
    }
  });

  it("rejects incomplete claims and requires a recorded CTO decision for HIGH work", () => {
    expect(evaluateChecklist(completeMediumBody, { headSha: prHead }).errors).toEqual([]);
    expect(evaluateChecklist(completeMediumBody.replace("- [x] Playwright", "- [ ] Playwright")).errors)
      .toEqual(expect.arrayContaining([expect.stringMatching(/unchecked/i)]));

    const highWithoutDecision = completeMediumBody
      .replace("Classification: MEDIUM", "Classification: HIGH")
      .replace(
        "Frozen zone: no frozen files or actions are touched",
        "Frozen zone changes are authorized by the linked CTO decision",
      );
    expect(evaluateChecklist(highWithoutDecision).errors)
      .toEqual(expect.arrayContaining([expect.stringMatching(/CTO decision/i)]));

    const highWithDecision = `${highWithoutDecision}
- [x] CTO decision recorded before implementation
  - Decision: destiny-product/DEPLOY_LOG.md#cto-governance-decision-gov-1
`;
    expect(evaluateChecklist(highWithDecision, { headSha: prHead }).errors).toEqual([]);
  });

  it("requires an attributed technical GO review at the exact PR head on every PR", () => {
    const withoutReceipt = completeMediumBody.replace(/## Technical review[\s\S]*$/, "");
    expect(evaluateChecklist(withoutReceipt, { headSha: prHead }).errors)
      .toEqual(expect.arrayContaining([expect.stringMatching(/technical review item/i)]));

    expect(evaluateChecklist(completeMediumBody.replace("Verdict: GO", "Verdict: HOLD"), { headSha: prHead }).errors)
      .toEqual(expect.arrayContaining([expect.stringMatching(/verdict must be GO/i)]));

    expect(evaluateChecklist(completeMediumBody.replace(`Reviewed head: ${prHead}`, `Reviewed head: ${staleHead}`), { headSha: prHead }).errors)
      .toEqual(expect.arrayContaining([expect.stringMatching(/not the PR head/i)]));

    expect(evaluateChecklist(completeMediumBody.replace("Reviewed on: 2026-09-04", "Reviewed on: today"), { headSha: prHead }).errors)
      .toEqual(expect.arrayContaining([expect.stringMatching(/review date/i)]));

    expect(evaluateChecklist(completeMediumBody.replace(`sha=${prHead}`, `sha=${staleHead}`), { headSha: prHead }).errors)
      .toEqual(expect.arrayContaining([expect.stringMatching(/Build-stamp evidence names/i)]));

    const review = evaluateTechnicalReview(completeMediumBody, prHead);
    expect(review).toMatchObject({ verdict: "GO", reviewedHead: prHead, errors: [] });
  });

  it("accepts owner-delegated execution only under a valid, fresh, head-bound OEA record", () => {
    const record = (overrides: Partial<{ head: string; oeaHead: string; actions: string; at: string }> = {}) => {
      const head = overrides.head ?? prHead;
      const actions = overrides.actions ?? "cto-approved, merge";
      return {
        created_at: "2026-09-04T18:41:00Z",
        author: "joseangelo510",
        body: [
          "Owner execution authorization",
          "- Executed by: Codex",
          "- Authorized by: Jose Gallegos (joseangelo510)",
          `- OEA: OEA #98 ${overrides.oeaHead ?? head}: ${actions}`,
          `- Authorized at: ${overrides.at ?? "2026-09-04T18:40:00Z"}`,
          `- Authorized head: ${head}`,
          `- Authorized actions: ${actions}`,
        ].join("\n"),
      };
    };
    const base = {
      files: ["destiny-product/DEPLOY_LOG.md"],
      labels: ["cto-approved"],
      labelActors: { "cto-approved": "joseangelo510" },
      dependencyDecision: { high: false, reasons: [] },
      prNumber: 98,
      headSha: prHead,
      labelTimes: { "cto-approved": "2026-09-04T18:45:00Z" },
    };

    expect(evaluatePolicyGuard({ ...base, delegationRecord: null })).toMatchObject({ execution: "personal", errors: [] });
    expect(evaluatePolicyGuard({ ...base, delegationRecord: record() })).toMatchObject({ execution: "delegated", errors: [] });
    expect(evaluatePolicyGuard({ ...base, delegationRecord: record({ head: staleHead }) }).errors)
      .toEqual(expect.arrayContaining([expect.stringMatching(/not the PR head/i)]));
    expect(evaluatePolicyGuard({ ...base, delegationRecord: record({ actions: "merge" }) }).errors)
      .toEqual(expect.arrayContaining([expect.stringMatching(/does not authorize it/i)]));
    expect(evaluatePolicyGuard({ ...base, delegationRecord: record(), labelTimes: { "cto-approved": "2026-09-04T18:30:00Z" } }).errors)
      .toEqual(expect.arrayContaining([expect.stringMatching(/before the delegation record/i)]));
    expect(evaluatePolicyGuard({ ...base, delegationRecord: record(), labelTimes: { "cto-approved": "2026-09-04T19:50:00Z" } }).errors)
      .toEqual(expect.arrayContaining([expect.stringMatching(/60-minute OEA window/i)]));
    expect(evaluateDelegation({ record: { ...record(), body: "Owner execution authorization - VOID (head changed)" }, prNumber: 98, headSha: prHead }))
      .toMatchObject({ mode: "void", errors: [] });

    expect(parseOwnerExecutionAuthorization("just go", { prNumber: 98, headSha: prHead }).ok).toBe(false);
    expect(parseOwnerExecutionAuthorization("OEA #98 c0daa602: merge", { prNumber: 98, headSha: prHead }).ok).toBe(false);
    expect(parseOwnerExecutionAuthorization(`OEA #98 ${prHead}: cto-approved, policy-change, merge`, { prNumber: 98, headSha: prHead }))
      .toMatchObject({ ok: true, number: 98, head: prHead, actions: ["cto-approved", "policy-change", "merge"] });
    expect(parseOwnerExecutionAuthorization(`OEA #99 ${prHead}: merge`, { prNumber: 98, headSha: prHead }).errors)
      .toEqual(expect.arrayContaining([expect.stringMatching(/names PR #99/i)]));
  });

  it("installs one canonical policy with thin agent and cloud pointers", async () => {
    for (const required of [
      "HARNESS_POLICY.md",
      "AGENTS.md",
      "CLAUDE.md",
      "docs/HARNESS_RUNBOOK.md",
      "docs/DESTINY_GOVERNANCE_POINTER.md",
      ".claude/skills/destiny-harness/SKILL.md",
      ".github/workflows/policy-guard.yml",
      ".github/workflows/checklist-guard.yml",
    ]) expect(await exists(required), required).toBe(true);

    const policy = await readFile(path.join(repositoryRoot, "HARNESS_POLICY.md"), "utf8");
    expect(policy).toContain("Complete means merged with all required checks green at the merge SHA");
    expect(policy).toContain("Jose Gallegos owns product intent and approval authority");

    expect(policy).toContain("Claude/Fable consultation is not required");
    expect(policy).toContain("## Owner Execution Authorization");
    expect(policy).toContain("OEA #<pr> <40-char head>: <actions>");

    for (const pointer of ["AGENTS.md", "CLAUDE.md"]) {
      const contents = await readFile(path.join(repositoryRoot, pointer), "utf8");
      expect(contents).toContain("HARNESS_POLICY.md");
      expect(contents).toContain("Supabase Auth Site URL");
      expect(contents).toContain("container-staging");
      expect(contents).toContain("Never claim a gate passed without");
    }

    for (const mirror of ["AGENTS.md", "CLAUDE.md", ".claude/skills/destiny-harness/SKILL.md", "docs/DESTINY_GOVERNANCE_POINTER.md", ".github/pull_request_template.md"]) {
      const contents = await readFile(path.join(repositoryRoot, mirror), "utf8");
      expect(contents, mirror).toMatch(/HARNESS_POLICY\.md|Technical review/);
    }
  });
});
