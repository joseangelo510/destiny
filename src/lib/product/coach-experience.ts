export const DEFAULT_WEEKLY_TASK_LIMIT = 8;

export const PRIMARY_NAVIGATION = [
  { label: "This week", href: "/this-week" },
  { label: "Roadmap", href: "/roadmap" },
  { label: "Game Plan", href: "/results" },
  { label: "Analytics", href: "/analytics" },
] as const;

export const FEATURE_NAVIGATION = [
  { label: "Home", href: "/" },
  { label: "Website audits", href: "/audits" },
  { label: "Content studio", href: "/content" },
  { label: "Keyword strategy", href: "/keywords" },
  { label: "Distribution", href: "/distribution" },
  { label: "Reviews", href: "/reviews" },
  { label: "Connections", href: "/integrations" },
  { label: "LLM visibility", href: "/llm-visibility" },
] as const;

type CoachTask = {
  id: string;
  task_type: string;
  category?: string | null;
  status: string;
  verification_status?: string | null;
  priority: number;
};

const taskOrder: Record<string, number> = {
  keyword_review: 0,
  primary_quest: 1,
  content_review: 2,
  community_distribution: 3,
  distribution: 3,
  social_distribution: 4,
  publisher_outreach: 5,
  directory_growth: 6,
  reviews: 6,
  technical_review: 7,
  measurement: 98,
  business_confirmation: 98,
  vocabulary_review: 98,
};

export const COACH_CATEGORIES = [
  {
    id: "research-strategy",
    label: "Research & strategy",
    description: "Review the research Destiny completed, approve your keyword direction, and handle the highest-impact recommendation.",
    taskTypes: ["keyword_review"],
  },
  {
    id: "content-creation",
    label: "Content creation",
    description: "Review three article topics, improve the drafts, and choose CMS or editable-document delivery.",
    taskTypes: ["content_review"],
  },
  {
    id: "distribution",
    label: "Distribution",
    description: "Join community conversations, share on social, contact publishers, and build listings and reviews.",
    taskTypes: ["community_distribution", "distribution", "social_distribution", "publisher_outreach", "directory_growth", "reviews"],
  },
  {
    id: "technical-seo",
    label: "Technical SEO",
    description: "Fix crawlability, indexing, page structure, and performance issues found on your website.",
    taskTypes: ["primary_quest", "technical_review"],
  },
] as const;

const NON_COACHING_TASKS = new Set(["business_confirmation", "vocabulary_review", "measurement"]);

export function getActionableCoachTasks<T extends CoachTask>(tasks: T[]): T[] {
  return tasks.filter((task) => !NON_COACHING_TASKS.has(task.task_type));
}

export function orderCoachTasks<T extends CoachTask>(tasks: T[]): T[] {
  return [...tasks].sort((left, right) => {
    const leftOrder = taskOrder[left.task_type] ?? 99;
    const rightOrder = taskOrder[right.task_type] ?? 99;
    return leftOrder - rightOrder || left.priority - right.priority;
  });
}

export function getCoachTaskWindow<T extends CoachTask>(tasks: T[], expanded: boolean): T[] {
  const ordered = orderCoachTasks(getActionableCoachTasks(tasks));
  return expanded ? ordered : ordered.slice(0, DEFAULT_WEEKLY_TASK_LIMIT);
}

export function getCurrentCoachTask<T extends CoachTask>(tasks: T[]): T | null {
  const ordered = orderCoachTasks(getActionableCoachTasks(tasks));
  return ordered.find((task) => task.status === "in_progress")
    ?? ordered.find((task) => task.status === "todo")
    ?? null;
}

export function firstOpenTaskIndex(tasks: Array<Pick<CoachTask, "status">>): number {
  return tasks.findIndex((task) => task.status === "todo" || task.status === "in_progress");
}

export function groupCoachTasks<T extends CoachTask>(tasks: T[]) {
  const ordered = orderCoachTasks(getActionableCoachTasks(tasks));
  return COACH_CATEGORIES.map((category) => ({
    ...category,
    tasks: ordered.filter((task) => taskMatchesCoachCategory(task, category.id, category.taskTypes)),
  })).filter((category) => category.tasks.length > 0);
}

export function groupCoachTasksForLoop<T extends CoachTask>(tasks: T[]) {
  const ordered = orderCoachTasks(getActionableCoachTasks(tasks));
  return COACH_CATEGORIES.map((category) => ({
    ...category,
    tasks: ordered.filter((task) => taskMatchesCoachCategory(task, category.id, category.taskTypes)),
  }));
}

function taskMatchesCoachCategory(task: CoachTask, categoryId: string, taskTypes: readonly string[]) {
  if (task.task_type === "primary_quest" && task.category === "reviews") return categoryId === "distribution";
  return taskTypes.includes(task.task_type);
}

export function guidedTaskPath(task: { task_type: string; action_path: string }) {
  if (task.task_type !== "primary_quest" || task.action_path.includes("#")) return task.action_path;
  return `${task.action_path.replace(/\/$/, "")}#recommended-fix`;
}

const TASK_ROADMAP_TARGETS: Record<string, string> = {
  keyword_review: "Get ready to be found",
  content_review: "Get ready to be found",
  primary_quest: "Get ready to be found",
  technical_review: "Get ready to be found",
  community_distribution: "Build visibility",
  distribution: "Build visibility",
  social_distribution: "Build visibility",
  publisher_outreach: "Grow what works",
  directory_growth: "Grow what works",
  reviews: "Grow what works",
  measurement: "Grow what works",
};

export function taskRoadmapTarget(taskType: string) {
  return TASK_ROADMAP_TARGETS[taskType] ?? "Grow what works";
}

export function completionPresentation(task: Pick<CoachTask, "status" | "verification_status">) {
  if (task.status === "complete" && task.verification_status === "verified") {
    return {
      label: "Verified by Destiny",
      tone: "verified" as const,
      detail: "Destiny checked the available site or connected data and confirmed this change.",
    };
  }
  if (task.status === "complete") {
    return {
      label: "Marked done by you",
      tone: "reported" as const,
      detail: "You marked this done. Destiny will check it when automatic verification is available.",
    };
  }
  if (task.status === "skipped") {
    return { label: "Skipped for now", tone: "open" as const, detail: "This task remains available when you are ready." };
  }
  return { label: "Ready to start", tone: "open" as const, detail: "Follow the guided step, then mark it complete." };
}

type AuditIssue = { code?: unknown; label?: unknown; severity?: unknown; userTitle?: unknown; userExplanation?: unknown; recommendedSteps?: unknown };

const PLAIN_LANGUAGE_FIXES: Record<string, { title: string; narrative: string; explanation: string; steps: string[] }> = {
  has_render_blocking_resources: {
    title: "Make your homepage load faster for visitors",
    narrative: "Make your homepage load faster for visitors.",
    explanation: "Some behind-the-scenes website files make people wait before they can see your page. Loading the most important parts first helps visitors get there sooner.",
    steps: [
      "Open your homepage in Google PageSpeed Insights and find the section about files delaying the first view of the page.",
      "Ask your website developer or site builder to load the visible page first and delay any files that are not needed right away.",
      "Run a fresh Destiny audit after the change so Destiny can verify the improvement.",
    ],
  },
  no_title: {
    title: "Give your homepage a clear search title",
    narrative: "Tell Google and visitors what your homepage is about.",
    explanation: "Your homepage is missing the title Google normally uses in search results.",
    steps: [
      "Open the SEO settings for your homepage in your website platform.",
      "Write a concise title that includes your primary service and market.",
      "Publish the change and run a fresh Destiny audit.",
    ],
  },
  no_description: {
    title: "Add a clear search description to your homepage",
    narrative: "Give searchers a clearer reason to visit your website.",
    explanation: "Your homepage is missing the short description that can appear beneath its title in Google.",
    steps: [
      "Open the SEO settings for your homepage.",
      "Add a one- or two-sentence description of who you help and the outcome you provide.",
      "Publish the change and run a fresh Destiny audit.",
    ],
  },
  high_loading_time: {
    title: "Reduce the time visitors wait for your homepage",
    narrative: "Help visitors reach your homepage faster.",
    explanation: "The page takes longer than three seconds to load, which can increase exits and make search growth harder.",
    steps: [
      "Test the homepage in Google PageSpeed Insights.",
      "Compress oversized images and remove or delay unused scripts.",
      "Run a fresh Destiny audit after publishing the changes.",
    ],
  },
};

export function buildGuidedFix(issue?: AuditIssue | null) {
  const code = typeof issue?.code === "string" ? issue.code : "";
  const predefined = PLAIN_LANGUAGE_FIXES[code];
  if (predefined) return { title: predefined.title, explanation: predefined.explanation, steps: predefined.steps };
  const label = typeof issue?.label === "string" && issue.label.trim() ? sentence(issue.label) : "Review the highest-impact website recommendation.";
  return {
    title: label.replace(/[.!?]+$/, ""),
    explanation: "Destiny found a website issue that can affect search visibility or the visitor experience.",
    steps: [
      "Share this finding with the person who manages your website.",
      "Make the recommended change in your website platform.",
      "Run a fresh Destiny audit so Destiny can check the result.",
    ],
  };
}

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
  const code = typeof topIssue?.code === "string" ? topIssue.code : "";
  const predefined = PLAIN_LANGUAGE_FIXES[code];
  const title = typeof topIssue?.userTitle === "string" && topIssue.userTitle.trim()
    ? sentence(topIssue.userTitle)
    : predefined?.narrative ?? (topIssue && typeof topIssue.label === "string"
      ? sentence(topIssue.label)
      : sentence(primaryTaskTitle || "Your first priority is ready"));
  const explanation = typeof topIssue?.userExplanation === "string" && topIssue.userExplanation.trim()
    ? topIssue.userExplanation
    : predefined
    ? `${predefined.explanation.replace(/[.!?]+$/, "")}. This can make people leave and can weaken search performance for ${businessName}.`
    : `Fix this first so ${businessName} has a stronger foundation for every content and visibility task that follows.`;
  return {
    eyebrow: "Your clearest next move",
    title,
    explanation,
    actionLabel: "Show me how to fix this",
  };
}
