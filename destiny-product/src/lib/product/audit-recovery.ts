export const AUDIT_STALL_SECONDS = 180;

export function auditHasStalled({
  nowMs = Date.now(),
  status,
  updatedAt,
}: {
  nowMs?: number;
  status?: string | null;
  updatedAt?: string | null;
}) {
  if (status !== "running" || !updatedAt) return false;
  const updatedMs = Date.parse(updatedAt);
  if (!Number.isFinite(updatedMs)) return false;
  return nowMs - updatedMs >= AUDIT_STALL_SECONDS * 1_000;
}

export function recoverAbandonedAudit<T extends {
  status?: string | null;
  updated_at?: string | null;
  failure_message?: string | null;
}>(audit: T, nowMs = Date.now()) {
  if (!auditHasStalled({ nowMs, status: audit.status, updatedAt: audit.updated_at })) return audit;
  return {
    ...audit,
    status: "failed",
    failure_message: "The audit stopped before saving the next research checkpoint. Your answers are safe—review them and try again.",
  };
}
