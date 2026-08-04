import type { DestinyLogicInput, DestinyLogicResult } from "../logicaffeine";

export type QuestStatus = "complete" | "todo" | "skipped";

const TASK_CODES: Record<string, number> = {
  business_confirmation: 1,
  primary_quest: 2,
  keyword_review: 3,
  content_review: 4,
  vocabulary_review: 5,
};

const STATUS_CODES: Record<string, number> = { todo: 0, complete: 1, skipped: 2 };

export function questTransitionInput({
  currentStatus,
  remainingAfterCompletion,
  requestedStatus,
  taskType,
}: {
  currentStatus: string;
  remainingAfterCompletion: number;
  requestedStatus: string;
  taskType: string;
}): Partial<DestinyLogicInput> {
  return {
    questTaskCode: TASK_CODES[taskType] ?? 6,
    questCurrentStatusCode: STATUS_CODES[currentStatus] ?? 9,
    questRequestedStatusCode: STATUS_CODES[requestedStatus] ?? 9,
    questRemainingAfterCompletion: remainingAfterCompletion,
  };
}

export function buildQuestCompletionUpdate(status: QuestStatus, now: string, policy: DestinyLogicResult) {
  if (!policy.questTransitionAllowed) {
    throw new Error(`Quest transition rejected: ${policy.questTransitionRuleId}`);
  }
  return {
    status,
    completed_at: policy.questSetCompletedAt ? now : null,
    verification_status: policy.questVerificationStatus,
    verified_at: policy.questSetVerifiedAt ? now : null,
    verification_method: policy.questSetVerifiedAt ? "user_confirmation" : null,
  };
}

export function isStreakActionableTask(taskType: string) {
  return taskType !== "business_confirmation" && taskType !== "vocabulary_review";
}
