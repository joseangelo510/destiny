export type GuidanceState = "active" | "waiting" | "blocked";

export type GuidanceStateInput = {
  guidanceState: GuidanceState;
  followUpAt?: string | null;
  blockerReason?: string | null;
  blockerOwner?: string | null;
};

export function isActionableGuidanceState(state?: string | null, followUpAt?: string | null, now = new Date()) {
  if (!state || state === "active") return true;
  if (state !== "waiting" || !followUpAt) return false;
  const followUp = new Date(followUpAt);
  return !Number.isNaN(followUp.getTime()) && followUp <= now;
}

export function guidancePresentation(task: { guidance_state?: string | null; follow_up_at?: string | null; blocker_reason?: string | null; blocker_owner?: string | null }) {
  if (task.guidance_state === "waiting") {
    return { label: "Waiting", detail: task.follow_up_at ? `Resumes ${new Date(task.follow_up_at).toLocaleDateString()}.` : "Needs a follow-up date.", tone: "waiting" as const };
  }
  if (task.guidance_state === "blocked") {
    return { label: "Blocked", detail: `${task.blocker_owner || "An owner"} needs to resolve: ${task.blocker_reason || "No reason saved."}`, tone: "blocked" as const };
  }
  return { label: "Ready", detail: "This task is available when it becomes the next useful step.", tone: "active" as const };
}

export function validateGuidanceStateInput(input: GuidanceStateInput) {
  if (input.guidanceState === "active") return { valid: true as const, update: { guidance_state: "active", follow_up_at: null, blocker_reason: null, blocker_owner: null } };
  if (input.guidanceState === "waiting") {
    const followUp = input.followUpAt ? new Date(input.followUpAt) : null;
    if (!followUp || Number.isNaN(followUp.getTime())) return { valid: false as const, error: "Choose a valid follow-up date." };
    return { valid: true as const, update: { guidance_state: "waiting", follow_up_at: followUp.toISOString(), blocker_reason: null, blocker_owner: null } };
  }
  const reason = input.blockerReason?.trim();
  const owner = input.blockerOwner?.trim();
  if (!reason || !owner) return { valid: false as const, error: "Add both a short reason and the person who can unblock it." };
  return { valid: true as const, update: { guidance_state: "blocked", follow_up_at: null, blocker_reason: reason, blocker_owner: owner } };
}
