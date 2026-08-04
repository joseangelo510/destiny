import type { DestinyLogicInput, DestinyLogicResult } from "./logic.ts";

type AuditIssue = { code: string; severity: "critical" | "warning" };

const ISSUE_INPUTS = {
  has_render_blocking_resources: ["criticalRenderBlocking", "warningRenderBlocking"],
  high_loading_time: ["criticalHighLoading", "warningHighLoading"],
  no_title: ["criticalNoTitle", "warningNoTitle"],
  no_description: ["criticalNoDescription", "warningNoDescription"],
  no_h1_tag: ["criticalNoH1", "warningNoH1"],
  no_image_alt: ["criticalNoAlt", "warningNoAlt"],
} as const;

export function encodeAuditIssues(issues: AuditIssue[]): Partial<DestinyLogicInput> {
  const encoded: Record<string, number> = { unknownIssueCount: 0 };
  for (const issue of issues) {
    const keys = ISSUE_INPUTS[issue.code as keyof typeof ISSUE_INPUTS];
    if (!keys) {
      encoded.unknownIssueCount += 1;
      continue;
    }
    const key = issue.severity === "critical" ? keys[0] : keys[1];
    encoded[key] = (encoded[key] ?? 0) + 1;
  }
  return encoded as Partial<DestinyLogicInput>;
}

export function assertRecommendationManifest(logic: DestinyLogicResult) {
  const expected = logic.weeklyTaskManifest.length;
  if (
    logic.weeklyTaskApprovals.length !== expected
    || logic.weeklyTaskTiers.length !== expected
    || logic.weeklyTaskPriorities.length !== expected
    || logic.weeklyTaskCount !== expected
  ) {
    throw new Error("LOGOS returned inconsistent weekly recommendation metadata.");
  }
}
