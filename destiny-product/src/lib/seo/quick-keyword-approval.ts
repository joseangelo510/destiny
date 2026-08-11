type SavedKeywordDecision = {
  keyword: string;
  decision: "approved" | "declined";
};

type QuickKeywordApproval = {
  approvals: string[];
  approvedCount: number;
  missing: number;
  ready: boolean;
};

const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value)
  ? value as Record<string, unknown>
  : {};

const normalized = (value: string) => value.trim().toLocaleLowerCase();

/**
 * Selects only the ordered, evidence-backed recommendations persisted by the
 * completed audit. This is intentionally stricter than the full review screen:
 * a legacy or incomplete strategy must be reviewed by a person instead.
 */
export function selectQuickKeywordApprovals(
  rawProviderPayload: unknown,
  existingDecisions: SavedKeywordDecision[],
  target: number,
): QuickKeywordApproval {
  const approved = new Set(existingDecisions.filter((item) => item.decision === "approved").map((item) => normalized(item.keyword)));
  const declined = new Set(existingDecisions.filter((item) => item.decision === "declined").map((item) => normalized(item.keyword)));
  const needed = Math.max(0, target - approved.size);
  if (needed === 0) return { approvals: [], approvedCount: approved.size, missing: 0, ready: true };

  const raw = record(rawProviderPayload);
  const providerResult = record(raw.providerResult);
  const candidates = Array.isArray(providerResult.keywords) ? providerResult.keywords : [];
  const seen = new Set<string>();
  const eligible = candidates.flatMap((value) => {
    const candidate = record(value);
    const keyword = typeof candidate.keyword === "string" ? candidate.keyword.trim() : "";
    const key = normalized(keyword);
    const searchVolume = Number(candidate.searchVolume ?? 0);
    const priorityScore = Number(candidate.priorityScore ?? 0);
    const hasSemanticEvidence = typeof candidate.priorityReason === "string" && candidate.priorityReason.trim().length > 0
      && typeof candidate.themeId === "string" && candidate.themeId.trim().length > 0
      && typeof candidate.themeLabel === "string" && candidate.themeLabel.trim().length > 0;
    if (!keyword || searchVolume <= 0 || priorityScore <= 0 || !hasSemanticEvidence || approved.has(key) || declined.has(key) || seen.has(key)) return [];
    seen.add(key);
    return [keyword];
  });

  if (eligible.length < needed) {
    return { approvals: [], approvedCount: approved.size, missing: needed - eligible.length, ready: false };
  }
  return { approvals: eligible.slice(0, needed), approvedCount: approved.size, missing: 0, ready: true };
}
