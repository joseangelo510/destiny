export type GamePlanTask = {
  category?: string | null;
  status: string;
  task_type: string;
};

export type GamePlanInput = {
  approvedKeywords: number;
  auditCompletedAt?: string | null;
  businessName: string;
  criticalIssues: number;
  estimatedOrganicTraffic: number;
  normalizedDomain: string;
  rankingKeywords: number;
  tasks: GamePlanTask[];
  usableKeywords: number;
  dataQualityFlags?: number;
};

export type BusinessIdentity = {
  displayName: string;
  needsReview: boolean;
  canExport: boolean;
};

const COMPANY_SUFFIXES = new Set(["co", "company", "corp", "corporation", "inc", "llc", "ltd"]);

function identityTokens(value: string) {
  return value
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/^www\./, "")
    .replace(/\.[a-z]{2,}(?:\.[a-z]{2})?$/i, "")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4 && !COMPANY_SUFFIXES.has(token));
}

function domainLabel(domain: string) {
  const root = domain.toLowerCase().replace(/^www\./, "").split(".")[0] || "Your business";
  return root
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export function businessIdentityMatchCount({
  businessName,
  normalizedDomain,
}: {
  businessName: string;
  normalizedDomain: string;
}) {
  const name = businessName.trim();
  const domain = normalizedDomain.trim();
  const domainCompact = identityTokens(domain).join("");
  const nameTokens = identityTokens(name);
  const nameCompact = nameTokens.join("");
  const matches = Boolean(name && domain && (
    domainCompact.includes(nameCompact)
    || nameCompact.includes(domainCompact)
    || nameTokens.some((token) => domainCompact.includes(token))
  ));

  return matches ? 1 : 0;
}

export async function resolveBusinessIdentity(input: { businessName: string; normalizedDomain: string }): Promise<BusinessIdentity> {
  const policy = await runDestinyServerLogic({
    auditComplete: 0, criticalIssues: 0, warnings: 0, rankingKeywords: 0, newKeywords: 0, lostKeywords: 0, contentGaps: 0, reviewCount: 0,
    planIdentityMatches: businessIdentityMatchCount(input),
  });
  return policy.planCanExport
    ? { displayName: input.businessName.trim(), needsReview: false, canExport: true }
    : { displayName: domainLabel(input.normalizedDomain), needsReview: true, canExport: false };
}

function countTasks(tasks: GamePlanTask[], predicate: (task: GamePlanTask) => boolean) {
  const matching = tasks.filter(predicate);
  return {
    complete: matching.filter((task) => task.status === "complete").length,
    total: matching.length,
  };
}

function monthLabel(start: Date, offset: number) {
  const value = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + offset, 1));
  return value.toLocaleDateString("en-US", { month: "long", timeZone: "UTC", year: "numeric" });
}

export async function buildGamePlan(input: GamePlanInput) {
  const identityMatches = businessIdentityMatchCount(input);
  const policy = await runDestinyServerLogic({
    auditComplete: 0, criticalIssues: 0, warnings: 0, rankingKeywords: 0, newKeywords: 0, lostKeywords: 0, contentGaps: 0, reviewCount: 0,
    planIdentityMatches: identityMatches,
    planApprovedKeywords: Math.max(0, input.approvedKeywords),
    planUsableKeywords: Math.max(0, input.usableKeywords),
    planDataQualityFlags: Math.max(0, input.dataQualityFlags ?? 0),
  });
  const identity: BusinessIdentity = policy.planCanExport
    ? { displayName: input.businessName.trim(), needsReview: false, canExport: true }
    : { displayName: domainLabel(input.normalizedDomain), needsReview: true, canExport: false };
  const start = input.auditCompletedAt && !Number.isNaN(Date.parse(input.auditCompletedAt))
    ? new Date(input.auditCompletedAt)
    : new Date();
  const contentProgress = countTasks(input.tasks, (task) => task.task_type === "content_review" || task.task_type === "keyword_review");
  const technicalProgress = countTasks(input.tasks, (task) => task.category === "technical" || task.task_type === "technical_review");
  const trustProgress = countTasks(input.tasks, (task) => task.category === "reviews" || [
    "community_distribution",
    "directory_growth",
    "distribution",
    "publisher_outreach",
    "reviews",
    "social_distribution",
  ].includes(task.task_type));
  const taskProgress = countTasks(input.tasks, () => true);
  const keywordTargetLow = policy.planKeywordTargetLow;
  const keywordTargetHigh = policy.planKeywordTargetHigh;
  const themeCopy = {
    foundation: { theme: "Build the foundation", milestones: ["Confirm the priority keyword direction", "Resolve the highest-impact technical issues", "Improve the most important existing pages", "Validate measurement and indexing"] },
    content_engine: { theme: "Build the content engine", milestones: ["Publish high-intent service and decision pages", "Create supporting educational content", "Strengthen internal links between related pages", "Begin repeatable review and distribution work"] },
    authority: { theme: "Expand authority", milestones: ["Distribute the strongest content", "Earn credible citations and mentions", "Refresh pages showing early traction", "Use verified results to choose the next quarter"] },
  } as const;

  return {
    ...identity,
    title: `${identity.displayName}’s 90-Day SEO Game Plan`,
    period: `${monthLabel(start, 0)}–${monthLabel(start, 2)}`,
    thesis: `Build a stronger search foundation, focus on valuable customer demand, and earn the trust signals ${identity.displayName} needs to become easier to find.`,
    taskProgress,
    baseline: [
      { label: "Ranking keywords", value: Math.max(0, input.rankingKeywords).toLocaleString() },
      { label: "Estimated organic visits", value: Math.max(0, Math.round(input.estimatedOrganicTraffic)).toLocaleString() },
      { label: "Critical technical issues", value: Math.max(0, input.criticalIssues).toLocaleString() },
    ],
    plays: [
      {
        title: "Own valuable customer searches",
        description: "Prioritize buying, comparison, and problem-aware searches that have a credible path to revenue.",
        evidence: `${input.approvedKeywords} approved · ${input.usableKeywords} researched`,
        href: "/keywords",
        linkLabel: "Review keyword strategy",
      },
      {
        title: "Answer the questions customers ask",
        description: "Turn priority searches into useful service pages, articles, FAQs, and decision-support content.",
        evidence: `${contentProgress.complete} of ${contentProgress.total} planning milestones complete`,
        href: "/content",
        linkLabel: "Open content strategy",
      },
      {
        title: "Strengthen the website foundation",
        description: "Improve crawlability, indexing, page structure, internal links, and performance before scaling content.",
        evidence: `${technicalProgress.complete} of ${technicalProgress.total} foundation milestones complete`,
        href: "/audits",
        linkLabel: "Review technical evidence",
      },
      {
        title: "Build trust across the web",
        description: "Earn reviews, citations, links, community visibility, and credible source mentions that support search and AI discovery.",
        evidence: `${trustProgress.complete} of ${trustProgress.total} authority milestones complete`,
        href: "/distribution",
        linkLabel: "Review distribution strategy",
      },
    ],
    months: policy.planThemeCodes.map((code, index) => ({
      label: `Month ${index + 1}`,
      date: monthLabel(start, index),
      ...(themeCopy[code as keyof typeof themeCopy] ?? themeCopy.foundation),
    })),
    scope: {
      inThisQuarter: [
        "Priority keyword and search-intent direction",
        "A focused three-month content strategy",
        "High-impact technical SEO improvements",
        "Distribution, review, citation, and authority-building work",
        "Measurement of verified search and visibility signals",
      ],
      outThisQuarter: [
        "Guaranteed page-one rankings or traffic promises",
        "Fixing every low-priority issue at once",
        "A second 90-day plan before this quarter is reviewed",
      ],
    },
    forecasts: [
      {
        kind: "projection" as const,
        label: "Search coverage",
        baseline: `${input.rankingKeywords.toLocaleString()} ranking keywords today`,
        expectedRange: `${keywordTargetLow}–${keywordTargetHigh} priority themes actively targeted`,
        assumption: "Approved keywords remain relevant and the planned pages are published.",
        confidence: "High confidence in the work; outcomes depend on competition and domain authority.",
      },
      {
        kind: "projection" as const,
        label: "Content output",
        baseline: `${contentProgress.complete} planning milestones complete`,
        expectedRange: "6–12 priority pages or articles published or materially improved",
        assumption: "The weekly content workflow is completed consistently.",
        confidence: "High confidence because this measures controllable work.",
      },
      {
        kind: "projection" as const,
        label: "Authority signals",
        baseline: `${trustProgress.complete} authority milestones complete`,
        expectedRange: "8–20 credible distribution, review, citation, or outreach actions",
        assumption: "Destiny’s weekly distribution and trust-building actions are completed.",
        confidence: "Medium confidence; publication and third-party responses are not fully controllable.",
      },
      {
        kind: "projection" as const,
        label: "Early search traction",
        baseline: `${Math.max(0, Math.round(input.estimatedOrganicTraffic)).toLocaleString()} estimated organic visits`,
        expectedRange: "New impressions and keyword movement may begin within 60–90 days",
        assumption: "Technical blockers are addressed and useful pages are indexed.",
        confidence: policy.planForecastConfidence === "limited"
          ? "Limited confidence until missing search evidence is available."
          : "Directional only—not a traffic or ranking guarantee.",
      },
    ],
    forecastDisclaimer: "Search rankings and traffic cannot be guaranteed. Destiny forecasts likely progress from the current baseline, planned work, competition, domain authority, and consistent execution. Verified outcomes appear only in Analytics.",
  };
}

export type GamePlan = Awaited<ReturnType<typeof buildGamePlan>>;
import { runDestinyServerLogic } from "../logicaffeine-server";
