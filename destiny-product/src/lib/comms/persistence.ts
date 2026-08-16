import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import { eventRoute, type NotificationEventType, type WeekState } from "./contracts";
import { createWeekContinuity, recordQualifyingAction, type WeekContinuity } from "./week";

type DestinyClient = SupabaseClient<Database>;

function weekFromRow(row: Database["public"]["Tables"]["comms_weeks"]["Row"]): WeekContinuity {
  return {
    localWeekStart: row.local_week_start,
    weekNumber: row.week_number,
    windowStartAt: row.window_start_at,
    fridayRiskAt: row.friday_risk_at,
    sundayLastChanceAt: row.sunday_last_chance_at,
    windowEndAt: row.window_end_at,
    userTimezone: row.user_timezone,
    state: row.state as WeekState,
    streakLength: row.streak_length,
    qualifyingActionCount: row.qualifying_action_count,
    recoveryActionCount: row.recovery_action_count,
    recoveryExpiresAt: row.recovery_expires_at,
    freezesRemaining: row.freezes_remaining,
    freezesResetAt: row.freezes_reset_at,
  };
}

function weekWrite(continuity: WeekContinuity) {
  return {
    local_week_start: continuity.localWeekStart,
    week_number: continuity.weekNumber,
    user_timezone: continuity.userTimezone,
    window_start_at: continuity.windowStartAt,
    friday_risk_at: continuity.fridayRiskAt,
    sunday_last_chance_at: continuity.sundayLastChanceAt,
    window_end_at: continuity.windowEndAt,
    state: continuity.state,
    streak_length: continuity.streakLength,
    qualifying_action_count: continuity.qualifyingActionCount,
    recovery_action_count: continuity.recoveryActionCount,
    recovery_expires_at: continuity.recoveryExpiresAt,
    freezes_remaining: continuity.freezesRemaining,
    freezes_reset_at: continuity.freezesResetAt,
  };
}

async function insertEvent({
  supabase,
  organizationId,
  websiteId,
  userId,
  userTimezone,
  occurredAt,
  type,
  groupingKey,
  dedupeKey,
  render,
  payload,
}: {
  supabase: DestinyClient;
  organizationId: string;
  websiteId: string;
  userId: string;
  userTimezone: string;
  occurredAt: string;
  type: NotificationEventType;
  groupingKey: string;
  dedupeKey: string;
  render: Record<string, Json | undefined>;
  payload: Record<string, Json | undefined>;
}) {
  const route = eventRoute(type);
  const { data, error } = await supabase.from("comms_notification_events").insert({
    organization_id: organizationId,
    website_id: websiteId,
    user_id: userId,
    occurred_at: occurredAt,
    user_timezone: userTimezone,
    type,
    job: route.job,
    priority: route.priority,
    grouping_key: groupingKey,
    dedupe_key: dedupeKey,
    bypass_batch: route.bypassBatch,
    render,
    payload,
  }).select("event_id").maybeSingle();
  if (error?.code === "23505") return { eventId: null, duplicate: true, error: null };
  return { eventId: data?.event_id ?? null, duplicate: false, error };
}

export async function recordQuestActionCompletion({
  supabase,
  userId,
  websiteId,
  questId,
  questTitle,
  completedAt,
  actionPath,
}: {
  supabase: DestinyClient;
  userId: string;
  websiteId: string;
  questId: string;
  questTitle: string;
  completedAt: string;
  actionPath: string;
}) {
  const occurredAt = new Date(completedAt);
  if (Number.isNaN(occurredAt.getTime())) return { recorded: false, reason: "invalid_completion_time" as const };

  const [{ data: website, error: websiteError }, { data: preference }] = await Promise.all([
    supabase.from("websites").select("organization_id").eq("id", websiteId).maybeSingle(),
    supabase.from("comms_preferences").select("user_timezone").eq("website_id", websiteId).eq("user_id", userId).maybeSingle(),
  ]);
  if (websiteError || !website) return { recorded: false, reason: "website_unavailable" as const, error: websiteError };
  const userTimezone = preference?.user_timezone || "UTC";

  const emptyWeek = createWeekContinuity(occurredAt, userTimezone);
  const { data: existing } = await supabase.from("comms_weeks")
    .select("*")
    .eq("website_id", websiteId)
    .eq("user_id", userId)
    .eq("local_week_start", emptyWeek.localWeekStart)
    .maybeSingle();

  let continuity = existing ? weekFromRow(existing) : emptyWeek;
  if (!existing) {
    const { data: previous } = await supabase.from("comms_weeks")
      .select("streak_length,freezes_remaining,freezes_reset_at,state")
      .eq("website_id", websiteId)
      .eq("user_id", userId)
      .lt("local_week_start", emptyWeek.localWeekStart)
      .order("local_week_start", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (previous) {
      continuity = createWeekContinuity(occurredAt, userTimezone, {
        streakLength: previous.state === "broken" ? 0 : previous.streak_length,
        freezesRemaining: previous.freezes_remaining,
        freezesResetAt: previous.freezes_reset_at,
      });
    }
  }

  const actionEvent = await insertEvent({
    supabase,
    organizationId: website.organization_id,
    websiteId,
    userId,
    userTimezone,
    occurredAt: completedAt,
    type: "quest.action_completed",
    groupingKey: `${websiteId}:quest-completions:${continuity.localWeekStart}`,
    dedupeKey: `quest.action_completed:${questId}:${completedAt}`,
    render: { title: questTitle, objectName: questTitle, objectUrl: actionPath },
    payload: { questId, localWeekStart: continuity.localWeekStart },
  });
  if (actionEvent.error) return { recorded: false, reason: "event_write_failed" as const, error: actionEvent.error };
  if (actionEvent.duplicate) return { recorded: false, reason: "duplicate" as const };

  const transition = recordQualifyingAction(continuity, occurredAt);
  const { error: weekError } = await supabase.from("comms_weeks").upsert({
    organization_id: website.organization_id,
    website_id: websiteId,
    user_id: userId,
    ...weekWrite(transition.continuity),
  }, { onConflict: "website_id,user_id,local_week_start" });
  if (weekError) return { recorded: false, reason: "week_write_failed" as const, error: weekError };

  const transitionWrites = transition.emitted.map((type) => insertEvent({
    supabase,
    organizationId: website.organization_id,
    websiteId,
    userId,
    userTimezone,
    occurredAt: completedAt,
    type,
    groupingKey: `${websiteId}:continuity:${transition.continuity.localWeekStart}`,
    dedupeKey: `${type}:${transition.continuity.localWeekStart}`,
    render: { title: type === "week.completed" ? "Your Week is safe" : "Your Week recovered", objectUrl: "/this-week" },
    payload: { localWeekStart: transition.continuity.localWeekStart, streakLength: transition.continuity.streakLength },
  }));
  await Promise.all(transitionWrites);

  if (actionEvent.eventId) {
    await supabase.from("comms_achievements").upsert({
      organization_id: website.organization_id,
      website_id: websiteId,
      user_id: userId,
      achievement_key: "first_useful_step",
      source_event_id: actionEvent.eventId,
      earned_at: completedAt,
    }, { onConflict: "website_id,user_id,achievement_key", ignoreDuplicates: true });
  }
  return { recorded: true, continuity: transition.continuity, emitted: transition.emitted, eventId: actionEvent.eventId };
}
