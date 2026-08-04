export type AuditTimingStatus = "running" | "complete" | "failed";

const NORMAL_AUDIT_SECONDS = 30;

export type AuditTimingPolicy = Pick<DestinyLogicResult, "momentumTimingDelayed" | "momentumTimingSeconds">;

export function auditElapsedSeconds(nowMs: number, startedAt?: string | null) {
  const startedMs = startedAt ? Date.parse(startedAt) : Number.NaN;
  return nowMs > 0 && Number.isFinite(startedMs)
    ? Math.max(0, Math.floor((nowMs - startedMs) / 1000))
    : 0;
}

export function auditTimingFromPolicy(policy: AuditTimingPolicy) {
  return {
    secondsRemaining: policy.momentumTimingSeconds < 0 ? null : policy.momentumTimingSeconds,
    delayed: policy.momentumTimingDelayed,
    normalSeconds: NORMAL_AUDIT_SECONDS,
  };
}

export async function auditTimingEstimate({
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
  const policy = await runDestinyServerLogic({
    auditComplete: 0, criticalIssues: 0, warnings: 0, rankingKeywords: 0,
    newKeywords: 0, lostKeywords: 0, contentGaps: 0, reviewCount: 0,
    momentumAuditProgress: Number.isFinite(progress) ? Math.round(progress) : 0,
    momentumAuditStatusCode: momentumStatusCode(status),
    momentumElapsedSeconds: auditElapsedSeconds(nowMs, startedAt),
  });
  return auditTimingFromPolicy(policy);
}
import type { DestinyLogicResult } from "../logicaffeine";
import { runDestinyServerLogic } from "../logicaffeine-server";
import { momentumStatusCode } from "./momentum-journey";
