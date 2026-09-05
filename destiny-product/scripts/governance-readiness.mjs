import { evaluateChecklist, evaluatePolicyGuard } from "./governance-policy.mjs";

const paths = [".github/workflows/ci.yml", ".github/workflows/staging-evidence.yml"];
const missingApproval = new Set(["HIGH changes require the cto-approved label.", "HARNESS_POLICY.md requires the policy-change label."]);

export function verifyEvidenceRuns(body, headSha, runs) {
  const errors = [];
  const current = runs.filter((run) => run.head_sha === headSha && run.event === "pull_request");
  for (const workflow of paths) {
    const latest = current.filter((run) => run.path === workflow).sort((a, b) => b.id - a.id)[0];
    if (!latest || latest.status !== "completed" || latest.conclusion !== "success") {
      errors.push(`Awaiting successful current-head ${workflow}.`);
      continue;
    }
    const labels = workflow === paths[0]
      ? ["Vitest full suite green", "ESLint, English-only rule, and file-length ratchet green", "Playwright journeys green"]
      : ["Build stamp on staging matches this PR SHA"];
    for (const label of labels) {
      const block = body.split(`- [x] ${label}`)[1]?.split(/\n- \[/)[0] ?? "";
      const ids = [...block.matchAll(/https:\/\/github\.com\/joseangelo510\/destiny\/actions\/runs\/(\d+)\b/g)].map((match) => Number(match[1]));
      if (!ids.includes(latest.id)) errors.push(`${label}: link the latest successful current-head run ${latest.id}.`);
    }
  }
  return errors;
}

export function evaluateReadiness(mode, context) {
  if (!["policy", "checklist"].includes(mode)) throw new Error("Unknown governance mode.");
  const result = mode === "policy" ? evaluatePolicyGuard(context) : evaluateChecklist(context.body, context);
  const invalidAuthority = mode === "policy" && result.errors.some((error) => !missingApproval.has(error));
  const reasons = [...result.errors];
  if (context.draft) reasons.push("Draft PR: waiting for ready for review.");
  if (mode === "checklist") reasons.push(...verifyEvidenceRuns(context.body, context.headSha, context.runs ?? []));
  return { state: invalidAuthority ? "failure" : reasons.length ? "waiting" : "success", reasons };
}

export function checkPayload(mode, headSha, result, detailsUrl) {
  const waiting = result.state === "waiting";
  return {
    name: `${mode}-guard`, head_sha: headSha,
    status: waiting ? "in_progress" : "completed",
    ...(waiting ? {} : { conclusion: result.state, completed_at: new Date().toISOString() }),
    ...(detailsUrl ? { details_url: detailsUrl } : {}),
    output: {
      title: waiting ? "Waiting for required evidence or approval" : result.state === "success" ? "Requirements verified" : "Invalid approval evidence",
      summary: (result.reasons.join("\n\n") || "Current-head requirements verified.").slice(0, 60000),
    },
  };
}
