export type OnboardingStep = 1 | 2 | 3 | 4 | 5 | 6;

export type OnboardingProgress = {
  accountCreatedAt: string;
  auditCompletedAt: string | null;
  approvedKeywordCount: number;
  articleDraftCount: number;
  integrationCount: number;
  completedActionCount: number;
  sentSteps: OnboardingStep[];
};

export type OnboardingEmailDefinition = {
  step: OnboardingStep;
  trigger: string;
  fallbackHours: number;
  subject: string;
  ctaLabel: string;
  ctaPath: string;
  timeCostMinutes: number;
};

export const ONBOARDING_EMAILS: readonly OnboardingEmailDefinition[] = [
  { step: 1, trigger: "account created", fallbackHours: 0, subject: "Start with the website Destiny should understand", ctaLabel: "Finish website setup", ctaPath: "/onboarding", timeCostMinutes: 5 },
  { step: 2, trigger: "first audit data landed", fallbackHours: 24, subject: "Your first Destiny evidence is ready", ctaLabel: "See the first evidence", ctaPath: "/results", timeCostMinutes: 10 },
  { step: 3, trigger: "five keywords approved", fallbackHours: 48, subject: "Turn your saved searches into a clear direction", ctaLabel: "Review keyword strategy", ctaPath: "/keywords", timeCostMinutes: 10 },
  { step: 4, trigger: "first article draft ready", fallbackHours: 72, subject: "Your first content draft is ready to shape", ctaLabel: "Review the draft", ctaPath: "/content", timeCostMinutes: 15 },
  { step: 5, trigger: "first measurement connection", fallbackHours: 120, subject: "Connect evidence to the work you are doing", ctaLabel: "Connect a data source", ctaPath: "/integrations", timeCostMinutes: 8 },
  { step: 6, trigger: "first useful action completed", fallbackHours: 168, subject: "Keep one useful Week moving", ctaLabel: "Open this Week", ctaPath: "/this-week", timeCostMinutes: 15 },
] as const;

function hoursSince(timestamp: string, now: Date) {
  return (now.getTime() - new Date(timestamp).getTime()) / (60 * 60 * 1000);
}

function behaviorComplete(step: OnboardingStep, progress: OnboardingProgress) {
  if (step === 1) return true;
  if (step === 2) return Boolean(progress.auditCompletedAt);
  if (step === 3) return progress.approvedKeywordCount >= 5;
  if (step === 4) return progress.articleDraftCount >= 1;
  if (step === 5) return progress.integrationCount >= 1;
  return progress.completedActionCount >= 1;
}

export function nextOnboardingEmail(progress: OnboardingProgress, now = new Date()): OnboardingEmailDefinition | null {
  const accountAgeHours = hoursSince(progress.accountCreatedAt, now);
  for (const definition of ONBOARDING_EMAILS) {
    if (progress.sentSteps.includes(definition.step)) continue;
    const behaviorTriggered = behaviorComplete(definition.step, progress);
    if (behaviorTriggered || accountAgeHours >= definition.fallbackHours) return definition;
    return null;
  }
  return null;
}

export function shouldSuppressOnboardingNudge(step: OnboardingStep, progress: OnboardingProgress) {
  return step > 1 && behaviorComplete(step, progress);
}
