export type AuditTimingStatus = "running" | "complete" | "failed";

const NORMAL_AUDIT_SECONDS = 30;
const DELAYED_AFTER_SECONDS = 45;

export function auditTimingEstimate({
  nowMs = 0,
  progress,
  startedAt,
  status,
}: {
  nowMs?: number;
  progress: number;
  startedAt?: string | null;
  status: AuditTimingStatus;
}) {
  if (status === "complete") return { secondsRemaining: 0, delayed: false, normalSeconds: NORMAL_AUDIT_SECONDS };
  if (status === "failed") return { secondsRemaining: null, delayed: false, normalSeconds: NORMAL_AUDIT_SECONDS };

  const normalizedProgress = Math.min(99, Math.max(0, Number.isFinite(progress) ? progress : 0));
  const startedMs = startedAt ? Date.parse(startedAt) : Number.NaN;
  const elapsedSeconds = nowMs > 0 && Number.isFinite(startedMs)
    ? Math.max(0, Math.floor((nowMs - startedMs) / 1000))
    : 0;
  if (elapsedSeconds > DELAYED_AFTER_SECONDS) {
    return { secondsRemaining: null, delayed: true, normalSeconds: NORMAL_AUDIT_SECONDS };
  }

  const progressSeconds = NORMAL_AUDIT_SECONDS * (1 - normalizedProgress / 100);
  const secondsRemaining = Math.max(5, Math.ceil(progressSeconds / 5) * 5);
  return { secondsRemaining, delayed: false, normalSeconds: NORMAL_AUDIT_SECONDS };
}
