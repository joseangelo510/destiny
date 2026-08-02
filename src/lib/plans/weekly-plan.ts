export type PlanTierId = "beginner" | "moderate" | "super_growth";

export const PLAN_TIERS = [
  { id: "beginner", label: "Beginner", taskCount: 3, minutes: 30, description: "Three focused actions with Destiny guiding every step." },
  { id: "moderate", label: "Moderate", taskCount: 5, minutes: 60, description: "A balanced weekly rhythm across content, optimization, and distribution." },
  { id: "super_growth", label: "Super Growth", taskCount: 8, minutes: 120, description: "The full growth loop for teams ready to move faster." },
] as const;

export type WeeklyTaskBlueprint = {
  title: string;
  why: string;
  type: "vocabulary_review" | "content_review" | "primary_quest" | "distribution" | "keyword_review" | "reviews" | "measurement";
  category: "technical" | "content" | "distribution" | "reviews" | "measurement";
  actionPath: string;
  estimatedMinutes: number;
  requiresApproval: boolean;
  externalUrl?: string;
};

type DistributionOpportunity = { platform: "Reddit" | "Quora"; title: string; url: string };

export function buildWeekOneTasks(input: {
  tier: PlanTierId;
  auditId: string;
  primaryQuest: string;
  contentKeyword: string;
  hasVocabulary: boolean;
  distributionOpportunities: DistributionOpportunity[];
}) {
  const reddit = input.distributionOpportunities.find((item) => item.platform === "Reddit");
  const quora = input.distributionOpportunities.find((item) => item.platform === "Quora");
  const tasks: WeeklyTaskBlueprint[] = [
    {
      title: input.hasVocabulary ? "Review and approve your site vocabulary" : "Add the words customers use to find you",
      why: "Destiny uses this vocabulary to keep every keyword recommendation relevant to your real business.",
      type: "vocabulary_review",
      category: "measurement",
      actionPath: "/keywords",
      estimatedMinutes: 5,
      requiresApproval: true,
    },
    {
      title: `Review and approve the “${input.contentKeyword}” article`,
      why: "A short human review keeps the content accurate before it is sent to your CMS.",
      type: "content_review",
      category: "content",
      actionPath: "/content",
      estimatedMinutes: 15,
      requiresApproval: true,
    },
    {
      title: input.primaryQuest,
      why: "LOGOS selected this as the highest-impact action from the latest audit.",
      type: "primary_quest",
      category: "technical",
      actionPath: `/audits/${input.auditId}`,
      estimatedMinutes: 10,
      requiresApproval: false,
    },
    {
      title: reddit ? `Contribute to: ${reddit.title}` : "Find one relevant Reddit conversation",
      why: "A useful answer in a current discussion can earn qualified referral visibility without automated posting.",
      type: "distribution",
      category: "distribution",
      actionPath: "/distribution",
      estimatedMinutes: 15,
      requiresApproval: true,
      externalUrl: reddit?.url,
    },
    {
      title: "Review your essential competitor keyword gaps",
      why: "These are relevant phrases covered by at least two competitors but not by your website.",
      type: "keyword_review",
      category: "content",
      actionPath: "/keywords",
      estimatedMinutes: 15,
      requiresApproval: true,
    },
    {
      title: quora ? `Answer: ${quora.title}` : "Find one relevant Quora question",
      why: "Answering a real question makes your expertise discoverable where people are already researching.",
      type: "distribution",
      category: "distribution",
      actionPath: "/distribution",
      estimatedMinutes: 15,
      requiresApproval: true,
      externalUrl: quora?.url,
    },
    {
      title: "Ask three recent customers for a review",
      why: "Fresh first-party proof improves trust and supports local search conversion.",
      type: "reviews",
      category: "reviews",
      actionPath: "/reviews",
      estimatedMinutes: 15,
      requiresApproval: false,
    },
    {
      title: "Review your LLM visibility and cited-domain gap",
      why: "This shows whether AI answers mention your company and which sources they cite instead.",
      type: "measurement",
      category: "measurement",
      actionPath: "/llm-visibility",
      estimatedMinutes: 15,
      requiresApproval: false,
    },
  ];
  const tier = PLAN_TIERS.find((item) => item.id === input.tier) ?? PLAN_TIERS[0];
  return tasks.slice(0, tier.taskCount);
}
