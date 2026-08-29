export const AI_CITATION_BENCHMARK = {
  id: "semrush-top-cited-domains-2025-10",
  source: "Semrush — The Most-Cited Domains in AI",
  sourceUrl: "https://www.semrush.com/blog/most-cited-domains-ai/",
  asOf: "October 2025",
  promptCount: 230_000,
  description: "Industry benchmark across ChatGPT search, Google AI Mode, and Perplexity. It is directional research, not evidence that a customer is cited.",
  domains: [
    { rank: 1, domain: "reddit.com", label: "Reddit", action: "Answer relevant questions with specific, first-hand expertise.", fit: "community" },
    { rank: 2, domain: "linkedin.com", label: "LinkedIn", action: "Publish expert posts and maintain a complete company and founder presence.", fit: "social" },
    { rank: 3, domain: "wikipedia.org", label: "Wikipedia", action: "Treat as earned reference coverage only; never create promotional entries.", fit: "earned" },
    { rank: 4, domain: "medium.com", label: "Medium", action: "Republish selected expert perspectives with canonical links when appropriate.", fit: "publisher" },
    { rank: 5, domain: "youtube.com", label: "YouTube", action: "Turn high-value customer questions into useful, well-described videos.", fit: "video" },
    { rank: 6, domain: "google.com", label: "Google", action: "Strengthen crawlable owned pages, business information, and traditional search visibility.", fit: "owned" },
    { rank: 7, domain: "nih.gov", label: "NIH", action: "Relevant mainly to health and scientific organizations with publishable research.", fit: "industry" },
    { rank: 8, domain: "forbes.com", label: "Forbes", action: "Pursue earned expert commentary and editorial coverage when the story is credible.", fit: "earned" },
    { rank: 9, domain: "amazon.com", label: "Amazon", action: "Relevant to product businesses, authors, and brands with real marketplace listings.", fit: "commerce" },
    { rank: 10, domain: "microsoft.com", label: "Microsoft", action: "Relevant to products or research that legitimately belong in Microsoft ecosystems.", fit: "industry" },
    { rank: 11, domain: "arxiv.org", label: "arXiv", action: "Relevant to organizations producing original technical or academic research.", fit: "industry" },
    { rank: 12, domain: "prnewswire.com", label: "PR Newswire", action: "Use only for genuinely newsworthy, source-backed announcements.", fit: "earned" },
    { rank: 13, domain: "blog.google", label: "Google Blog", action: "An earned ecosystem source, not a channel most businesses can directly control.", fit: "earned" },
    { rank: 14, domain: "facebook.com", label: "Facebook", action: "Maintain accurate profiles and publish useful community-facing updates.", fit: "social" },
    { rank: 15, domain: "quora.com", label: "Quora", action: "Write complete, non-promotional answers to questions customers actually ask.", fit: "community" },
    { rank: 16, domain: "moldstud.com", label: "MoldStud", action: "Relevant only when its technical publishing audience matches the business.", fit: "industry" },
    { rank: 17, domain: "apple.com", label: "Apple", action: "Relevant to apps, podcasts, and businesses represented in Apple ecosystems.", fit: "industry" },
    { rank: 18, domain: "mdpi.com", label: "MDPI", action: "Relevant to organizations producing legitimate peer-reviewed research.", fit: "industry" },
    { rank: 19, domain: "g2.com", label: "G2", action: "Relevant to software companies that can earn complete profiles and customer reviews.", fit: "reviews" },
    { rank: 20, domain: "instagram.com", label: "Instagram", action: "Publish original visual expertise with clear profile and topic context.", fit: "social" },
  ],
} as const;

type QuestSignal = {
  task_type: string;
  status: string;
  verification_status?: string | null;
};

type LlmVisibilitySignal = {
  status?: unknown;
  totalMentions?: unknown;
  platforms?: Array<{ platform?: unknown; mentions?: unknown }>;
  topCitedDomains?: Array<{ domain?: unknown; mentions?: unknown }>;
};

type ProgressState = "not_started" | "in_progress" | "complete" | "monitoring" | "verified";

export type AiVisibilityStage = {
  id: string;
  kind: "effort" | "outcome";
  title: string;
  description: string;
  actionPath: string;
  state: ProgressState;
  evidenceLabel: string;
};

function matchingQuests(quests: QuestSignal[], taskTypes: string[]) {
  return quests.filter((quest) => taskTypes.includes(quest.task_type));
}

function effortStage({
  id,
  title,
  description,
  actionPath,
  quests,
  taskTypes,
}: {
  id: string;
  title: string;
  description: string;
  actionPath: string;
  quests: QuestSignal[];
  taskTypes: string[];
}): AiVisibilityStage {
  const matches = matchingQuests(quests, taskTypes);
  return {
    id,
    kind: "effort",
    title,
    description,
    actionPath,
    state: "not_started" as ProgressState,
    evidenceLabel: matches.find((quest) => quest.status === "complete")?.verification_status === "verified" ? "Detected by Rebound SEO" : matches.find((quest) => quest.status === "complete") ? "Marked done by you" : matches.length ? "Ready in your coaching plan" : "Not started",
  };
}

function effortEvidenceCode(quests: QuestSignal[], taskTypes: string[]) {
  const matches = matchingQuests(quests, taskTypes);
  return matches.some((quest) => quest.status === "complete") ? 2 : matches.length ? 1 : 0;
}

export async function buildAiVisibilityProgress({
  quests,
  llmVisibility,
}: {
  quests: QuestSignal[];
  llmVisibility: LlmVisibilitySignal;
}) {
  const contentTypes = ["content_review"];
  const platformTypes = ["community_distribution", "distribution", "social_distribution"];
  const authorityTypes = ["publisher_outreach", "directory_growth", "reviews"];
  const totalMentions = Math.max(0, Number(llmVisibility.totalMentions ?? 0));
  const evidenceAvailable = llmVisibility.status === "available";
  const platforms = Array.isArray(llmVisibility.platforms) ? llmVisibility.platforms : [];
  const policy = await runDestinyServerLogic({
    auditComplete: 0, criticalIssues: 0, warnings: 0, rankingKeywords: 0, newKeywords: 0, lostKeywords: 0, contentGaps: 0, reviewCount: 0,
    llmContentStateCode: effortEvidenceCode(quests, contentTypes), llmPlatformStateCode: effortEvidenceCode(quests, platformTypes),
    llmAuthorityStateCode: effortEvidenceCode(quests, authorityTypes), llmEvidenceAvailable: evidenceAvailable ? 1 : 0,
    llmMentions: totalMentions, llmPlatformPositiveCount: platforms.filter((platform) => Number(platform.mentions ?? 0) > 0).length,
  });
  const effortStages = [
    effortStage({
      id: "owned-source-content",
      title: "Create source-worthy answers",
      description: "Publish clear, original pages that answer the questions buyers and AI systems research.",
      actionPath: "/content",
      quests,
      taskTypes: contentTypes,
    }),
    effortStage({
      id: "trusted-platform-presence",
      title: "Build presence on cited platforms",
      description: "Contribute useful answers and expert content on relevant channels such as Reddit, LinkedIn, Quora, or YouTube.",
      actionPath: "/distribution",
      quests,
      taskTypes: platformTypes,
    }),
    effortStage({
      id: "third-party-authority",
      title: "Earn third-party corroboration",
      description: "Build legitimate reviews, listings, publisher mentions, and expert references beyond your own website.",
      actionPath: "/reviews",
      quests,
      taskTypes: authorityTypes,
    }),
  ];
  [policy.llmContentState, policy.llmPlatformState, policy.llmAuthorityState].forEach((state, index) => { effortStages[index].state = state; });
  const detected = policy.llmOutcomeState === "verified";
  const outcomeStage: AiVisibilityStage = {
    id: "verified-ai-visibility",
    kind: "outcome",
    title: "Verify AI mentions and citations",
    description: "Rebound SEO checks available provider data separately from the readiness work above.",
    actionPath: "/llm-visibility#verified-evidence",
    state: policy.llmOutcomeState,
    evidenceLabel: detected
      ? `${totalMentions.toLocaleString()} provider-detected mentions`
      : evidenceAvailable
        ? "Monitoring is active; no mentions detected yet"
        : "Connect or run supported AI visibility research",
  };
  const completed = effortStages.filter((stage) => stage.state === "complete").length;

  return {
    readiness: {
      completed,
      total: effortStages.length,
      label: `${completed} of ${effortStages.length} readiness actions complete`,
    },
    verifiedVisibility: {
      detected,
      totalMentions,
      platformCount: platforms.filter((platform) => Number(platform.mentions ?? 0) > 0).length,
      evidenceAvailable,
    },
    stages: [...effortStages, outcomeStage],
    nextStep: [...effortStages, outcomeStage][Math.max(0, policy.llmNextStep - 1)],
  };
}
import { runDestinyServerLogic } from "../logicaffeine-server";
