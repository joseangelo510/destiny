import { NextResponse } from "next/server";
import { buildQuestCompletionUpdate, isStreakActionableTask, questTransitionInput, type QuestStatus } from "../../../../lib/quests/completion";
import { createClient } from "../../../../lib/supabase/server";
import { runDestinyServerLogic } from "../../../../lib/logicaffeine-server";
import { validateGuidanceStateInput, type GuidanceState } from "../../../../lib/quests/guidance-state";
import { INITIAL_KEYWORD_APPROVAL_TARGET } from "../../../../lib/product/plan-horizon";
import { recordQuestActionCompletion } from "../../../../lib/comms/persistence";
import { isCommsBetaEnabled } from "../../../../lib/comms/feature";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({})) as { status?: unknown; guidanceState?: unknown; followUpAt?: unknown; blockerReason?: unknown; blockerOwner?: unknown };
  const guidanceState = body.guidanceState;
  if (guidanceState !== undefined) {
    if (guidanceState !== "active" && guidanceState !== "waiting" && guidanceState !== "blocked") {
      return NextResponse.json({ error: "Choose a valid guided task state." }, { status: 400 });
    }
  }
  if (body.status !== "complete" && body.status !== "todo" && body.status !== "skipped") {
    if (guidanceState === undefined) return NextResponse.json({ error: "Choose a valid quest status." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) {
    return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  }

  const { data: existingQuest, error: lookupError } = await supabase
    .from("quests")
    .select("id,task_type,status,audit_id,week_number,website_id,title,action_path")
    .eq("id", id)
    .maybeSingle();
  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 });
  if (!existingQuest) return NextResponse.json({ error: "Quest not found." }, { status: 404 });

  if (body.status === "complete" && existingQuest.task_type === "keyword_review") {
    if (!existingQuest.audit_id) return NextResponse.json({ error: "This keyword review is not connected to an audit. Run the audit again before completing it." }, { status: 409 });
    const { data: audit, error: auditError } = await supabase.from("audits")
      .select("website_id")
      .eq("id", existingQuest.audit_id)
      .maybeSingle();
    if (auditError || !audit) return NextResponse.json({ error: auditError?.message || "This keyword review is not connected to a website." }, { status: 409 });
    const { data: approvedKeywords, error: decisionsError } = await supabase.from("keyword_preferences")
      .select("keyword")
      .eq("website_id", audit.website_id)
      .eq("decision", "approved");
    if (decisionsError) return NextResponse.json({ error: decisionsError.message }, { status: 500 });
    const approvedCount = approvedKeywords?.length ?? 0;
    if (approvedCount < INITIAL_KEYWORD_APPROVAL_TARGET) {
      const remaining = INITIAL_KEYWORD_APPROVAL_TARGET - approvedCount;
      return NextResponse.json({
        error: `Approve at least ${INITIAL_KEYWORD_APPROVAL_TARGET} keywords before completing this review. ${remaining} more needed; you do not need to review every recommendation.`,
        approvedCount,
        requiredApprovals: INITIAL_KEYWORD_APPROVAL_TARGET,
      }, { status: 409 });
    }
  }

  if (guidanceState !== undefined) {
    if (existingQuest.status === "complete") return NextResponse.json({ error: "Reopen this completed task before changing its guided state." }, { status: 400 });
    const guided = validateGuidanceStateInput({
      guidanceState: guidanceState as GuidanceState,
      followUpAt: typeof body.followUpAt === "string" ? body.followUpAt : null,
      blockerReason: typeof body.blockerReason === "string" ? body.blockerReason : null,
      blockerOwner: typeof body.blockerOwner === "string" ? body.blockerOwner : null,
    });
    if (!guided.valid) return NextResponse.json({ error: guided.error }, { status: 400 });
    const { data: quest, error } = await supabase.from("quests").update(guided.update)
      .eq("id", id)
      .select("id,status,guidance_state,follow_up_at,blocker_reason,blocker_owner")
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!quest) return NextResponse.json({ error: "Quest not found." }, { status: 404 });
    return NextResponse.json({ quest });
  }

  let remainingAfterCompletion = -1;
  if (body.status === "complete" && isStreakActionableTask(existingQuest.task_type) && existingQuest.audit_id) {
    const { data: weekTasks, error: weekError } = await supabase.from("quests")
      .select("id,task_type,status")
      .eq("audit_id", existingQuest.audit_id)
      .eq("week_number", existingQuest.week_number);
    if (weekError) return NextResponse.json({ error: weekError.message }, { status: 500 });
    remainingAfterCompletion = (weekTasks ?? []).filter((task) => isStreakActionableTask(task.task_type) && task.id !== id && task.status !== "complete").length;
  }
  let policy: Awaited<ReturnType<typeof runDestinyServerLogic>>;
  try {
    policy = await runDestinyServerLogic({
      auditComplete: 0, criticalIssues: 0, warnings: 0, rankingKeywords: 0, newKeywords: 0, lostKeywords: 0, contentGaps: 0, reviewCount: 0,
      ...questTransitionInput({ currentStatus: existingQuest.status, requestedStatus: body.status as QuestStatus, taskType: existingQuest.task_type, remainingAfterCompletion }),
    });
  } catch (error) {
    console.error(JSON.stringify({ event: "logos_coaching_policy", questId: id, fallbacks: 0, wasm_errors: 1, outcome: "fail_closed", error: error instanceof Error ? error.message : "unknown" }));
    return NextResponse.json({ error: "Destiny could not safely update this task. Please try again." }, { status: 503 });
  }
  if (!policy.questTransitionAllowed) {
    return NextResponse.json({ error: "That task transition is not allowed.", ruleId: policy.questTransitionRuleId }, { status: 400 });
  }
  console.info(JSON.stringify({ event: "logos_coaching_policy", questId: id, ruleId: policy.questTransitionRuleId, fallbacks: 0, wasm_errors: 0, outcome: "allowed" }));
  const update = buildQuestCompletionUpdate(body.status as QuestStatus, new Date().toISOString(), policy);
  const { data: quest, error } = await supabase.from("quests").update(update)
    .eq("id", id)
    .select("id,status,completed_at,xp,verification_status,verified_at,verification_method")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!quest) return NextResponse.json({ error: "Quest not found." }, { status: 404 });
  if (isCommsBetaEnabled() && body.status === "complete" && existingQuest.status !== "complete" && isStreakActionableTask(existingQuest.task_type) && quest.completed_at) {
    const comms = await recordQuestActionCompletion({
      supabase,
      userId: claimsData.claims.sub,
      websiteId: existingQuest.website_id,
      questId: existingQuest.id,
      questTitle: existingQuest.title,
      completedAt: quest.completed_at,
      actionPath: existingQuest.action_path,
    });
    if (!comms.recorded && comms.reason !== "duplicate") {
      console.error(JSON.stringify({ event: "destiny_comms_action", questId: id, outcome: "deferred", reason: comms.reason }));
    }
  }
  return NextResponse.json({ quest, celebration: policy.questCelebration, transitionRuleId: policy.questTransitionRuleId });
}
