export const DEFAULT_WEEKLY_TASK_LIMIT = 3;

export const PRIMARY_NAVIGATION = [
  { label: "This week", href: "/this-week" },
  { label: "Results", href: "/results" },
  { label: "Settings & connections", href: "/integrations" },
] as const;

export const FEATURE_NAVIGATION = [
  { label: "Website audits", href: "/audits" },
  { label: "Six-month plan", href: "/growth-plan" },
  { label: "Content studio", href: "/content" },
  { label: "Keyword evidence", href: "/keywords" },
  { label: "Distribution", href: "/distribution" },
  { label: "Reviews", href: "/reviews" },
  { label: "Analytics", href: "/analytics" },
  { label: "LLM visibility", href: "/llm-visibility" },
] as const;

type CoachTask = {
  id: string;
  task_type: string;
  status: string;
  verification_status?: string | null;
  priority: number;
};

const taskOrder: Record<string, number> = {
  business_confirmation: 0,
  vocabulary_review: 0,
  primary_quest: 1,
  content_review: 2,
  keyword_review: 3,
  distribution: 4,
  reviews: 5,
  measurement: 6,
};

export function orderCoachTasks<T extends CoachTask>(tasks: T[]): T[] {
  return [...tasks].sort((left, right) => {
    const leftOrder = taskOrder[left.task_type] ?? 99;
    const rightOrder = taskOrder[right.task_type] ?? 99;
    return leftOrder - rightOrder || left.priority - right.priority;
  });
}

export function getCoachTaskWindow<T extends CoachTask>(tasks: T[], expanded: boolean): T[] {
  const ordered = orderCoachTasks(tasks);
  return expanded ? ordered : ordered.slice(0, DEFAULT_WEEKLY_TASK_LIMIT);
}

export function completionPresentation(task: Pick<CoachTask, "status" | "verification_status">) {
  if (task.status === "complete" && task.verification_status === "verified") {
    return {
      label: "Destiny verified",
      tone: "verified" as const,
      detail: "Destiny verified this change using connected or crawl evidence.",
    };
  }
  if (task.status === "complete") {
    return {
      label: "Marked complete",
      tone: "reported" as const,
      detail: "You marked this task complete. Destiny has not verified the change yet.",
    };
  }
  if (task.status === "skipped") {
    return { label: "Skipped for now", tone: "open" as const, detail: "This task remains available when you are ready." };
  }
  return { label: "Ready to start", tone: "open" as const, detail: "Follow the guided step, then mark it complete." };
}

type AuditIssue = { code?: unknown; label?: unknown; severity?: unknown };

function sentence(value: string) {
  const trimmed = value.trim().replace(/[.!?]+$/, "");
  if (!trimmed) return "Your first priority is ready.";
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}.`;
}

export function buildAuditNarrative({
  businessName,
  issues,
  primaryTaskTitle,
}: {
  businessName: string;
  issues: AuditIssue[];
  primaryTaskTitle?: string | null;
}) {
  const sorted = [...issues].sort((left, right) => Number(right.severity === "critical") - Number(left.severity === "critical"));
  const topIssue = sorted.find((issue) => typeof issue.label === "string" && issue.label.trim());
  const title = topIssue && typeof topIssue.label === "string"
    ? sentence(topIssue.label)
    : sentence(primaryTaskTitle || "Your first priority is ready");
  return {
    eyebrow: "Your clearest next move",
    title,
    explanation: `Fix this first so ${businessName} has a stronger foundation for every content and visibility task that follows.`,
    actionLabel: "Review your first task",
  };
}
