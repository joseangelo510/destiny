export type RoadmapNodeKind = "effort" | "outcome";
export type RoadmapNodeState = "complete" | "current" | "locked";

export type RoadmapQuest = {
  id?: string;
  title?: string;
  description?: string;
  category?: string | null;
  action_path?: string;
  task_type: string;
  status: string;
  verification_status?: string | null;
  week_number?: number;
  priority?: number;
};

export type RoadmapSearchConsole = {
  impressions?: unknown;
  clicks?: unknown;
  topQueries?: unknown;
};

export type RoadmapAnalytics = {
  organicKeyEvents?: unknown;
};

export type SeoRoadmapInput = {
  auditComplete: boolean;
  quests: RoadmapQuest[];
  searchConsole: RoadmapSearchConsole | null;
  analytics: RoadmapAnalytics | null;
};

export type SeoRoadmapNode = {
  id: string;
  label: string;
  kind: RoadmapNodeKind;
  state: RoadmapNodeState;
  description: string;
  typicalRange: string;
  evidence: string;
  actionHref: string;
  actionLabel: string;
};

export type SeoJourneyTask = {
  id: string;
  label: string;
  detail: string;
  state: "complete" | "current" | "future";
  actionHref: string;
  weekNumber: number;
};

export type SeoRoadmapPhase = {
  id: "ready" | "visibility" | "growth";
  timing: string;
  title: string;
  description: string;
  tasks: SeoJourneyTask[];
  signals: SeoRoadmapNode[];
};

const phaseDefinitions: Array<Omit<SeoRoadmapPhase, "tasks" | "signals"> & { signalIds: string[] }> = [
  {
    id: "ready",
    timing: "Days 1–30",
    title: "Get ready to be found",
    description: "Strengthen your website and publish useful content.",
    signalIds: ["pages-indexed"],
  },
  {
    id: "visibility",
    timing: "Days 31–60",
    title: "Build visibility",
    description: "Help more of the right people discover and visit you.",
    signalIds: ["first-impressions", "first-clicks", "page-two"],
  },
  {
    id: "growth",
    timing: "Days 61–90",
    title: "Grow what works",
    description: "Build on the search activity that produces real customer actions.",
    signalIds: ["page-one", "first-organic-lead", "compounding-authority"],
  },
];

function taskCode(taskType: string) {
  return ({ business_confirmation: 1, primary_quest: 2, keyword_review: 3, content_review: 4, vocabulary_review: 5, measurement: 7, community_distribution: 8, distribution: 9, social_distribution: 10, publisher_outreach: 11, directory_growth: 12, reviews: 13, technical_review: 14 } as Record<string, number>)[taskType] ?? 6;
}

function taskStatusCode(status: string) {
  if (status === "complete") return 1;
  if (status === "skipped") return 2;
  if (status === "in_progress") return 3;
  return 0;
}

function number(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function records(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
}

function completedQuest(quests: RoadmapQuest[], taskType: string) {
  return quests.find((quest) => quest.task_type === taskType && quest.status === "complete");
}

export async function buildSeoRoadmap(input: SeoRoadmapInput) {
  const foundations = completedQuest(input.quests, "primary_quest");
  const content = completedQuest(input.quests, "content_review");
  const impressions = number(input.searchConsole?.impressions);
  const clicks = number(input.searchConsole?.clicks);
  const keyEvents = number(input.analytics?.organicKeyEvents);
  const positions = records(input.searchConsole?.topQueries).map((query) => number(query.position)).filter((position) => position > 0);
  const pageOnePosition = positions.find((position) => position <= 10);
  const pageTwoPosition = positions.find((position) => position > 10 && position <= 20) ?? pageOnePosition;
  const hasSearchAppearance = impressions > 0;
  const hasPageOne = Boolean(pageOnePosition);
  const policy = await runDestinyServerLogic({
    auditComplete: 0, criticalIssues: 0, warnings: 0, rankingKeywords: 0, newKeywords: 0, lostKeywords: 0, contentGaps: 0, reviewCount: 0,
    progressAuditComplete: input.auditComplete ? 1 : 0,
    progressFoundationStatus: foundations ? foundations.verification_status === "verified" ? 2 : 1 : 0,
    progressContentStatus: content ? content.verification_status === "verified" ? 2 : 1 : 0,
    progressImpressions: impressions, progressClicks: clicks, progressPageOne: hasPageOne ? 1 : 0,
    progressPageTwo: pageTwoPosition ? 1 : 0, progressKeyEvents: keyEvents,
    progressProviderAvailable: input.searchConsole || input.analytics ? 1 : 0,
  });
  const hasCompoundingEvidence = policy.progressCompounding;

  const definitions: Array<Omit<SeoRoadmapNode, "state"> & { complete: boolean }> = [
    {
      id: "foundations",
      label: "Website ready",
      kind: "effort",
      complete: Boolean(foundations),
      description: "Complete the highest-impact technical or website task selected from your audit.",
      typicalRange: "Start here · usually one focused work session",
      evidence: foundations
        ? foundations.verification_status === "verified" ? "Rebound SEO verified the foundation task." : "The foundation task was marked complete by you."
        : input.auditComplete ? "Your audit is ready; the first foundation task is waiting." : "Your audit must finish before this step begins.",
      actionHref: "/this-week",
      actionLabel: "Open this week",
    },
    {
      id: "content-published",
      label: "First useful content live",
      kind: "effort",
      complete: Boolean(content),
      description: "Prepare, approve, and publish the first useful page or article from your strategy.",
      typicalRange: "Often 1–3 weeks after the foundation task",
      evidence: content
        ? content.verification_status === "verified" ? "Rebound SEO verified a published content task." : "The content workflow was marked complete by you; publication remains self-reported until Rebound SEO verifies a live page."
        : "Complete the content workflow and confirm publication when it is live.",
      actionHref: "/content",
      actionLabel: "Open content studio",
    },
    {
      id: "pages-indexed",
      label: "Pages showing in search",
      kind: "outcome",
      complete: hasSearchAppearance,
      description: "Google begins showing at least one of your pages in search results.",
      typicalRange: "Typically 2–8 weeks after publishing",
      evidence: hasSearchAppearance ? `${impressions.toLocaleString()} Search Console impressions confirm pages appeared in Google.` : "Waiting for connected Search Console evidence.",
      actionHref: hasSearchAppearance ? "/analytics" : "/integrations",
      actionLabel: hasSearchAppearance ? "View search data" : "Connect Search Console",
    },
    {
      id: "first-impressions",
      label: "People seeing you",
      kind: "outcome",
      complete: impressions > 0,
      description: "People begin seeing your pages for real searches.",
      typicalRange: "Typically 1–6 weeks after indexing",
      evidence: impressions > 0 ? `Search Console recorded ${impressions.toLocaleString()} impressions.` : "No verified Search Console impressions yet.",
      actionHref: "/analytics",
      actionLabel: "Review search data",
    },
    {
      id: "first-clicks",
      label: "People visiting you",
      kind: "outcome",
      complete: clicks > 0,
      description: "Searchers begin visiting your website from Google.",
      typicalRange: "Often 2–12 weeks after impressions begin",
      evidence: clicks > 0 ? `Search Console verified ${clicks.toLocaleString()} clicks.` : "No verified organic search clicks yet.",
      actionHref: "/distribution",
      actionLabel: "Build discovery",
    },
    {
      id: "page-two",
      label: "Rankings improving",
      kind: "outcome",
      complete: Boolean(pageTwoPosition),
      description: "A tracked query reaches positions 11–20—or advances beyond them.",
      typicalRange: "Often several months, depending on competition",
      evidence: pageTwoPosition ? `Search Console verified a query at position ${pageTwoPosition.toFixed(1)}.` : "No connected query has reached the top 20 yet.",
      actionHref: "/analytics",
      actionLabel: "Review rankings",
    },
    {
      id: "page-one",
      label: "Strong search visibility",
      kind: "outcome",
      complete: hasPageOne,
      description: "A tracked query reaches positions 1–10.",
      typicalRange: "Often 3–12+ months; difficult markets can take longer",
      evidence: pageOnePosition ? `Search Console verified a query at position ${pageOnePosition.toFixed(1)}.` : "No connected query has reached page one yet.",
      actionHref: "/analytics",
      actionLabel: "Review rankings",
    },
    {
      id: "first-organic-lead",
      label: "First customer action",
      kind: "outcome",
      complete: keyEvents > 0,
      description: "Organic search contributes a configured website conversion or key event.",
      typicalRange: "Timing depends on search intent, traffic, and the website offer",
      evidence: keyEvents > 0 ? `Google Analytics verified ${keyEvents.toLocaleString()} organic key event${keyEvents === 1 ? "" : "s"}.` : "Waiting for a verified organic key event in Google Analytics.",
      actionHref: "/integrations",
      actionLabel: "Connect Analytics",
    },
    {
      id: "compounding-authority",
      label: "Visibility growing consistently",
      kind: "outcome",
      complete: hasCompoundingEvidence,
      description: "Rankings, qualified clicks, and conversions repeat strongly enough to support the next growth loop.",
      typicalRange: "Ongoing · earned through repeated useful work",
      evidence: hasCompoundingEvidence
        ? `Verified with a page-one query, ${clicks.toLocaleString()} search clicks, and ${keyEvents.toLocaleString()} organic key event${keyEvents === 1 ? "" : "s"}.`
        : "Requires multiple verified signals: page-one visibility, at least 25 search clicks, and an organic key event.",
      actionHref: "/this-week",
      actionLabel: "Keep compounding",
    },
  ];

  const currentIndex = policy.progressCurrentNode > 0 ? policy.progressCurrentNode - 1 : -1;
  const nodes = definitions.map((node, index): SeoRoadmapNode => {
    const { complete, ...definition } = node;
    return {
      ...definition,
      state: complete ? "complete" : index === currentIndex ? "current" : "locked",
    };
  });
  const completedCount = nodes.filter((node) => node.state === "complete").length;
  const orderedQuests = [...input.quests].sort((left, right) => (left.week_number ?? 1) - (right.week_number ?? 1) || (left.priority ?? 99) - (right.priority ?? 99));
  const evaluatedQuests: Array<{ quest: RoadmapQuest; state: SeoJourneyTask["state"]; phaseId: SeoRoadmapPhase["id"] }> = [];
  let currentChosen = 0;
  const anyInProgress = orderedQuests.some((quest) => quest.status === "in_progress") ? 1 : 0;
  for (const quest of orderedQuests) {
    const taskPolicy = await runDestinyServerLogic({
      auditComplete: 0, criticalIssues: 0, warnings: 0, rankingKeywords: 0, newKeywords: 0, lostKeywords: 0, contentGaps: 0, reviewCount: 0,
      progressTaskCode: taskCode(quest.task_type), progressTaskStatusCode: taskStatusCode(quest.status), progressCurrentChosen: currentChosen, progressAnyInProgress: anyInProgress,
    });
    if (taskPolicy.progressTaskExcluded || quest.status === "skipped") continue;
    evaluatedQuests.push({ quest, state: taskPolicy.progressTaskState, phaseId: taskPolicy.progressTaskPhase });
    if (taskPolicy.progressTaskState === "current") currentChosen = 1;
  }
  const effortQuests = evaluatedQuests.map((item) => item.quest);
  const effortCompleted = effortQuests.filter((quest) => quest.status === "complete").length;
  const effortTotal = effortQuests.length;
  const effortProgress = effortTotal ? Math.round((effortCompleted / effortTotal) * 100) : 0;
  const journeyTasks = evaluatedQuests.map(({ quest, state, phaseId }, index): SeoJourneyTask & { phaseId: SeoRoadmapPhase["id"] } => {
    const copy = coachingTaskCopy(quest);
    return {
      id: quest.id ?? `${quest.task_type}-${index}`,
      label: copy.title,
      detail: copy.description,
      state,
      actionHref: guidedTaskPath({
        task_type: quest.task_type,
        category: quest.category,
        title: quest.title,
        action_path: quest.action_path?.trim() || "/this-week",
      }),
      weekNumber: Math.max(1, quest.week_number ?? 1),
      phaseId,
    };
  });
  const phases: SeoRoadmapPhase[] = phaseDefinitions.map(({ signalIds, ...phase }) => ({
    ...phase,
    tasks: journeyTasks.filter((task) => task.phaseId === phase.id),
    signals: nodes.filter((node) => signalIds.includes(node.id)),
  }));
  const pathProgress = Math.round(phases.reduce((total, phase) => {
    if (!phase.tasks.length) return total;
    const phaseCompleted = phase.tasks.filter((task) => task.state === "complete").length;
    return total + (phaseCompleted / phase.tasks.length) * (100 / phases.length);
  }, 0));
  console.info(JSON.stringify({ event: "logos_progress_roadmap", nodes: nodes.length, tasks: journeyTasks.length, fallbacks: 0, wasm_errors: 0 }));
  return {
    nodes,
    completedCount,
    progress: Math.round((completedCount / nodes.length) * 100),
    currentNode: nodes.find((node) => node.state === "current") ?? null,
    dataQuality: policy.progressDataQuality,
    effortCompleted,
    effortTotal,
    effortProgress,
    pathProgress,
    currentTask: journeyTasks.find((task) => task.state === "current") ?? null,
    phases,
  };
}
import { runDestinyServerLogic } from "../logicaffeine-server";
import { coachingTaskCopy, guidedTaskPath } from "./coach-experience";
