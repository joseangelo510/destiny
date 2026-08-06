import { runDestinyServerLogic } from "../logicaffeine-server";
import type { DestinyLogicInput } from "../logicaffeine";
import { isStreakActionableTask } from "./completion";

const weekMilliseconds = 7 * 24 * 60 * 60 * 1000;

function mondayUtc(value: Date) {
  const date = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return Math.floor(date.getTime() / weekMilliseconds);
}

type WeeklyProgressTask = {
  id?: string;
  audit_id: string | null;
  week_number: number;
  task_type: string;
  status: string;
  completed_at: string | null;
  created_at: string;
};

export function weeklyProgressPolicyInput(tasks: WeeklyProgressTask[], now = new Date()): Partial<DestinyLogicInput> {
  const seenTaskIds = new Set<string>();
  const actionable = tasks.filter((task) => {
    if (!isStreakActionableTask(task.task_type)) return false;
    if (!task.id) return true;
    if (seenTaskIds.has(task.id)) return false;
    seenTaskIds.add(task.id);
    return true;
  });
  const weekIndexes = [...new Set(actionable.flatMap((task) => {
    if (!task.completed_at) return [];
    const date = new Date(task.completed_at);
    return Number.isNaN(date.getTime()) ? [] : [mondayUtc(date)];
  }))].sort((left, right) => left - right);
  const plans = new Map<string, WeeklyProgressTask[]>();
  for (const task of actionable) {
    const created = new Date(task.created_at);
    const fallbackWeek = Number.isNaN(created.getTime()) ? task.created_at : String(mondayUtc(created));
    const key = `${task.audit_id || fallbackWeek}:${task.week_number}`;
    plans.set(key, [...(plans.get(key) ?? []), task]);
  }
  return {
    streakCurrentWeek: mondayUtc(now),
    streakWeekIndexes: weekIndexes,
    streakPlans: [...plans.values()].map((plan) => ({
      total: plan.length,
      complete: plan.filter((task) => task.status === "complete").length,
    })),
  };
}

export async function buildWeeklyProgressSummary(tasks: WeeklyProgressTask[], now = new Date()) {
  const logic = await runDestinyServerLogic({
    auditComplete: 0, criticalIssues: 0, warnings: 0, rankingKeywords: 0, newKeywords: 0, lostKeywords: 0, contentGaps: 0, reviewCount: 0,
    ...weeklyProgressPolicyInput(tasks, now),
  });
  return {
    currentStreak: logic.currentStreak,
    bestStreak: logic.bestStreak,
    perfectWeeks: logic.perfectWeeks,
    lifetimeActiveWeeks: logic.lifetimeActiveWeeks,
  };
}
