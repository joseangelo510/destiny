import { runDestinyServerLogic } from "../logicaffeine-server";

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
  { label: "Keyword research", href: "/keyword-research" },
  { label: "Rank tracker", href: "/rank-tracker" },
  { label: "Backlink analytics", href: "/backlinks" },
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
    description: "Join community conversations, share on social, contact niche creators, and build listings and reviews.",
    taskTypes: ["community_distribution", "distribution", "social_distribution", "publisher_outreach", "directory_growth", "reviews"],
  },
  {
    id: "technical-seo",
    label: "Technical SEO",
    description: "Fix crawlability, indexing, page structure, and performance issues found on your website.",
    taskTypes: ["primary_quest", "technical_review"],
  },
] as const;

function coachTaskCode(taskType: string) {
  return ({ business_confirmation: 1, primary_quest: 2, keyword_review: 3, content_review: 4, vocabulary_review: 5, measurement: 7, community_distribution: 8, distribution: 9, social_distribution: 10, publisher_outreach: 11, directory_growth: 12, reviews: 13, technical_review: 14 } as Record<string, number>)[taskType] ?? 6;
}

function coachStatusCode(status: string) {
  if (status === "complete") return 1;
  if (status === "skipped") return 2;
  if (status === "in_progress") return 3;
  return 0;
}

export async function buildCoachTaskSet<T extends CoachTask>(tasks: T[], expanded = true) {
  const anyInProgress = tasks.some((task) => task.status === "in_progress") ? 1 : 0;
  const evaluated = await Promise.all(tasks.map(async (task) => {
    const policy = await runDestinyServerLogic({
      auditComplete: 0, criticalIssues: 0, warnings: 0, rankingKeywords: 0, newKeywords: 0, lostKeywords: 0, contentGaps: 0, reviewCount: 0,
      progressTaskCode: coachTaskCode(task.task_type), progressTaskStatusCode: coachStatusCode(task.status),
      progressCurrentChosen: 1, progressTaskCategoryCode: task.category === "reviews" ? 2 : 0,
    });
    return { task, policy };
  }));
  const ordered = evaluated.filter((item) => !item.policy.progressTaskExcluded)
    .sort((left, right) => left.policy.coachTaskOrder - right.policy.coachTaskOrder || left.task.priority - right.task.priority);
  let currentChosen = 0;
  const resolved = [] as Array<{ task: T; category: DestinyLogicCategory; state: "complete" | "current" | "future" }>;
  for (const item of ordered) {
    const policy = await runDestinyServerLogic({
      auditComplete: 0, criticalIssues: 0, warnings: 0, rankingKeywords: 0, newKeywords: 0, lostKeywords: 0, contentGaps: 0, reviewCount: 0,
      progressTaskCode: coachTaskCode(item.task.task_type), progressTaskStatusCode: coachStatusCode(item.task.status), progressCurrentChosen: currentChosen,
      progressTaskCategoryCode: item.task.category === "reviews" ? 2 : 0, progressAnyInProgress: anyInProgress,
    });
    resolved.push({ task: item.task, category: policy.coachCategory, state: policy.progressTaskState });
    if (policy.progressTaskState === "current") currentChosen = 1;
  }
  const actionable = resolved.map((item) => item.task);
  const window = expanded ? actionable : actionable.slice(0, DEFAULT_WEEKLY_TASK_LIMIT);
  const categories = COACH_CATEGORIES.map((category) => ({
    ...category,
    tasks: resolved.filter((item) => item.category === category.id && window.includes(item.task)).map((item) => item.task),
  }));
  return {
    actionable,
    window,
    currentTask: resolved.find((item) => item.state === "current")?.task ?? null,
    groups: categories.filter((category) => category.tasks.length > 0),
    loopGroups: categories,
  };
}

type DestinyLogicCategory = (typeof COACH_CATEGORIES)[number]["id"];

export function guidedTaskPath(task: { task_type: string; action_path: string; category?: string | null }) {
  if (task.category === "reviews" || task.task_type === "reviews") return "/reviews";
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
