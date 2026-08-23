import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  classifyGovernanceChange,
  compareDependencyManifests,
  evaluateChecklist,
  evaluatePolicyGuard,
} from "../../scripts/governance-policy.mjs";

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
- [x] Fable review: Medium is sufficient
- [x] Frozen zone: no frozen files or actions are touched

## Harness evidence

- [x] Vitest full suite green
  - Run: https://github.com/joseangelo510/destiny/actions/runs/123
- [x] ESLint, English-only rule, and file-length ratchet green
  - Run: https://github.com/joseangelo510/destiny/actions/runs/123
- [x] Playwright journeys green
  - Run: https://github.com/joseangelo510/destiny/actions/runs/123
- [x] Build stamp on staging matches this PR SHA
  - Evidence: sha=0123456789abcdef0123456789abcdef01234567
- [x] Touched staging routes checked with zero 5xx
  - Evidence: /this-week=200
`;

describe("Destiny GOV-1 harness governance", () => {
  it("classifies ordinary work as MEDIUM and frozen surfaces as HIGH", () => {
    expect(classifyGovernanceChange(["destiny-product/src/app/this-week/page.tsx"]).level).toBe("MEDIUM");
    expect(classifyGovernanceChange(["destiny-product/src/app/globals.css"]).level).toBe("MEDIUM");
    expect(classifyGovernanceChange(["destiny-product/qa/rules/new.test.ts"]).level).toBe("MEDIUM");

    for (const frozen of [
      "HARNESS_POLICY.md",
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
    expect(evaluateChecklist(completeMediumBody).errors).toEqual([]);
    expect(evaluateChecklist(completeMediumBody.replace("- [x] Playwright", "- [ ] Playwright")).errors)
      .toEqual(expect.arrayContaining([expect.stringMatching(/unchecked/i)]));

    const highWithoutDecision = completeMediumBody
      .replace("Classification: MEDIUM", "Classification: HIGH")
      .replace("Fable review: Medium is sufficient", "Fable review: High required");
    expect(evaluateChecklist(highWithoutDecision).errors)
      .toEqual(expect.arrayContaining([expect.stringMatching(/CTO decision/i)]));

    const highWithDecision = `${highWithoutDecision}
- [x] CTO decision recorded before implementation
  - Decision: destiny-product/DEPLOY_LOG.md#cto-governance-decision-gov-1
`;
    expect(evaluateChecklist(highWithDecision).errors).toEqual([]);
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
    expect(policy).toContain("Conversational instructions do not override this file");

    for (const pointer of ["AGENTS.md", "CLAUDE.md"]) {
      const contents = await readFile(path.join(repositoryRoot, pointer), "utf8");
      expect(contents).toContain("HARNESS_POLICY.md");
      expect(contents).toContain("Supabase Auth Site URL");
      expect(contents).toContain("container-staging");
      expect(contents).toContain("Never claim a gate passed without");
    }
  });
});
