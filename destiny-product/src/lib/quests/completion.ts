export type QuestStatus = "complete" | "todo" | "skipped";

export function buildQuestCompletionUpdate(taskType: string, status: QuestStatus, now: string) {
  const completed = status === "complete";
  const confirmedBusiness = completed && taskType === "business_confirmation";
  return {
    status,
    completed_at: completed ? now : null,
    verification_status: confirmedBusiness ? "verified" : "unverified",
    verified_at: confirmedBusiness ? now : null,
    verification_method: confirmedBusiness ? "user_confirmation" : null,
  };
}
