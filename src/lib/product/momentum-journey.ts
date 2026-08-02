export type MomentumStageState = "complete" | "active" | "upcoming" | "failed";

type OnboardingStageDefinition = {
  id: string;
  title: string;
  description: string;
  celebration: string;
};

export type AuditMomentumStageDefinition = {
  id: string;
  title: string;
  description: string;
  activeMessage: string;
  completeAt: number;
};

export const ONBOARDING_MOMENTUM_STAGES: OnboardingStageDefinition[] = [
  {
    id: "business",
    title: "Business & website",
    description: "Give Destiny the story behind what you sell",
    celebration: "Business story captured",
  },
  {
    id: "audience",
    title: "Customer & market",
    description: "Define who you want search to bring you",
    celebration: "Audience direction added",
  },
  {
    id: "competitors",
    title: "Competitors & edge",
    description: "Show Destiny where you deserve to stand out",
    celebration: "Competitive edge mapped",
  },
  {
    id: "review",
    title: "Review & analyze",
    description: "Confirm the route and launch live research",
    celebration: "Research route ready",
  },
];

// These thresholds mirror the durable progress checkpoints saved by the audit
// worker. The UI never advances a research stage on a cosmetic timer.
export const AUDIT_MOMENTUM_STAGES: AuditMomentumStageDefinition[] = [
  {
    id: "business-context",
    title: "Your business story",
    description: "Your onboarding answers are saved as strategy context.",
    activeMessage: "Turning your answers into the brief an SEO strategist would use.",
    completeAt: 10,
  },
  {
    id: "website-baseline",
    title: "Website search health",
    description: "Destiny checks the homepage, rankings, and technical signals.",
    activeMessage: "Inspecting the live website and measuring its current search footprint.",
    completeAt: 30,
  },
  {
    id: "page-evidence",
    title: "Strategic page evidence",
    description: "Important service and product pages shape business relevance.",
    activeMessage: "Reading the pages that best explain what you sell and who it helps.",
    completeAt: 45,
  },
  {
    id: "competitor-map",
    title: "Competitor opportunities",
    description: "Live search overlap reveals gaps your business can own.",
    activeMessage: "Comparing your search footprint with real competitors and their ranking terms.",
    completeAt: 65,
  },
  {
    id: "revenue-keywords",
    title: "Revenue-ready keywords",
    description: "Intent, demand, difficulty, and competitor evidence set priority.",
    activeMessage: "Prioritizing keywords with a clear path from search intent to revenue.",
    completeAt: 80,
  },
  {
    id: "coaching-route",
    title: "Your coaching route",
    description: "Destiny turns the evidence into weekly actions and a six-month plan.",
    activeMessage: "Building a manageable first week and the route that follows it.",
    completeAt: 100,
  },
];

function clamp(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

export function onboardingMomentumJourney(step: number) {
  const currentNumber = clamp(step, 1, ONBOARDING_MOMENTUM_STAGES.length);
  const completedCount = currentNumber - 1;
  const stages = ONBOARDING_MOMENTUM_STAGES.map((stage, index) => ({
    ...stage,
    state: index < completedCount ? "complete" as const : index === completedCount ? "active" as const : "upcoming" as const,
  }));
  return {
    current: stages[currentNumber - 1],
    currentNumber,
    completedCount,
    percent: Math.round((completedCount / ONBOARDING_MOMENTUM_STAGES.length) * 100),
    stages,
  };
}

export function auditMomentumJourney(progress: number, status: "running" | "complete" | "failed") {
  const percent = status === "complete" ? 100 : clamp(progress, 0, 100);
  const completedCount = AUDIT_MOMENTUM_STAGES.filter((stage) => percent >= stage.completeAt).length;
  const currentIndex = Math.min(completedCount, AUDIT_MOMENTUM_STAGES.length - 1);
  const ready = status === "complete" && percent === 100;
  const stages = AUDIT_MOMENTUM_STAGES.map((stage, index) => ({
    ...stage,
    state: ready || index < completedCount
      ? "complete" as const
      : index === currentIndex
      ? status === "failed" ? "failed" as const : "active" as const
      : "upcoming" as const,
  }));
  const current = stages[currentIndex];
  return {
    completedCount,
    current,
    percent,
    ready,
    stages,
    statusLine: ready
      ? "100% saved. Your first coaching route is ready."
      : status === "failed"
      ? `Research paused after ${percent}% was saved.`
      : `${percent}% saved from live research. ${current.activeMessage}`,
  };
}
