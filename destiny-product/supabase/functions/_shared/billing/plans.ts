export type PlanId = "starter" | "growth" | "premium";
export type UsageLimits = {
  websites: number; articles: number; keywordSearches: number; domainReports: number;
  trackedTargets: number; shortOutputs: number; audits: number; infographics: number;
};
export type Meter = Exclude<keyof UsageLimits, "websites" | "trackedTargets">;
export type Plan = { id: PlanId; name: string; monthlyCents: number; description: string; limits: UsageLimits };
export const plans: readonly Plan[] = [
  { id: "starter", name: "Starter", monthlyCents: 3900, description: "A clear direction and weekly content for your business.", limits: { websites: 1, articles: 4, keywordSearches: 50, domainReports: 3, trackedTargets: 25, shortOutputs: 4, audits: 1, infographics: 0 } },
  { id: "growth", name: "Growth", monthlyCents: 9900, description: "Publish more often and grow a few websites.", limits: { websites: 3, articles: 12, keywordSearches: 150, domainReports: 10, trackedTargets: 75, shortOutputs: 12, audits: 3, infographics: 2 } },
  { id: "premium", name: "Premium", monthlyCents: 25000, description: "More content and research for your portfolio.", limits: { websites: 10, articles: 40, keywordSearches: 400, domainReports: 25, trackedTargets: 200, shortOutputs: 30, audits: 10, infographics: 5 } },
];
export const trialLimits: UsageLimits = { websites: 1, articles: 2, keywordSearches: 10, domainReports: 1, trackedTargets: 10, shortOutputs: 2, audits: 0, infographics: 0 };
export const meterLabels: Record<keyof UsageLimits, string> = {
  websites: "Managed websites", articles: "Full articles", keywordSearches: "Keyword searches",
  domainReports: "Domain reports", trackedTargets: "Tracked targets, refreshed weekly",
  shortOutputs: "Short repurposed outputs", audits: "Research and audit runs", infographics: "Researched infographics",
};
export function planById(value: unknown): Plan | null { return plans.find(plan => plan.id === value) ?? null; }
export type SubscriptionState = {
  plan: string; status: string; periodStart: string | null; periodEnd: string | null;
  paidThrough: string | null; trialEnd: string | null; cancelAtPeriodEnd: boolean;
};
export type AccessReason = "choose_plan" | "trial_ended" | "payment_required" | "available";
export type BillingAccess = { canReadSaved: true; canRunPaidWork: boolean; reason: AccessReason; limits: UsageLimits | null };
const denied = (reason: AccessReason): BillingAccess => ({ canReadSaved: true, canRunPaidWork: false, reason, limits: null });
const timestamp = (value: string | null) => value ? Date.parse(value) : NaN;
export function billingAccess(state: SubscriptionState | null, now = Date.now()): BillingAccess {
  const plan = planById(state?.plan);
  if (!state || !plan) return denied("choose_plan");
  if (state.status === "trialing") {
    if (!(timestamp(state.periodStart) <= now && timestamp(state.trialEnd) > now)) return denied("trial_ended");
    return { canReadSaved: true, canRunPaidWork: true, reason: "available", limits: trialLimits };
  }
  if (state.status !== "active" || !(timestamp(state.periodStart) <= now && timestamp(state.periodEnd) > now && timestamp(state.paidThrough) > now)) return denied("payment_required");
  return { canReadSaved: true, canRunPaidWork: true, reason: "available", limits: plan.limits };
}
