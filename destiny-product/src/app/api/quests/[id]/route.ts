import { NextResponse } from "next/server";
import { buildQuestCompletionUpdate, isStreakActionableTask, questTransitionInput, type QuestStatus } from "../../../../lib/quests/completion";
import { createClient } from "../../../../lib/supabase/server";
import { runDestinyServerLogic } from "../../../../lib/logicaffeine-server";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({})) as { status?: unknown };
  if (body.status !== "complete" && body.status !== "todo" && body.status !== "skipped") {
    return NextResponse.json({ error: "Choose a valid quest status." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) {
    return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  }

  const { data: existingQuest, error: lookupError } = await supabase
    .from("quests")
    .select("id,task_type,status,audit_id,week_number")
    .eq("id", id)
    .maybeSingle();
  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 });
  if (!existingQuest) return NextResponse.json({ error: "Quest not found." }, { status: 404 });

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
      ...questTransitionInput({ currentStatus: existingQuest.status, requestedStatus: body.status, taskType: existingQuest.task_type, remainingAfterCompletion }),
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
  return NextResponse.json({ quest, celebration: policy.questCelebration, transitionRuleId: policy.questTransitionRuleId });
}
