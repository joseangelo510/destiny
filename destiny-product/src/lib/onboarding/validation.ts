import { normalizeWebsite } from "../seo/url";
import type { DestinyLogicResult } from "../logicaffeine";
import { runDestinyServerLogic } from "../logicaffeine-server";

type StepOneInput = {
  firstName: string;
  lastName: string;
  email: string;
  businessName: string;
  website: string;
};

export function stepOneValidationFacts(input: StepOneInput) {
  const fieldCount = [input.firstName, input.lastName, input.email, input.businessName, input.website].filter((value) => value.trim()).length;
  const emailValid = /^\S+@\S+\.\S+$/.test(input.email.trim());
  let normalizedWebsite: string | null = null;
  try {
    normalizedWebsite = normalizeWebsite(input.website).url;
  } catch { /* URL parsing stays a host boundary; LOGOS owns final eligibility. */ }
  return { fieldCount, emailValid, normalizedWebsite, urlValid: normalizedWebsite !== null };
}

export function stepTwoValidationFacts(input: { productsServices: string; problem: string; customer: string; audienceGoals: string }) {
  return { fieldCount: [input.productsServices, input.problem, input.customer, input.audienceGoals].filter((value) => value.trim()).length };
}

export function onboardingValidationFromPolicy(policy: Pick<DestinyLogicResult, "onboardingOneReady" | "onboardingTwoReady">, one: ReturnType<typeof stepOneValidationFacts>) {
  return { stepOne: { ready: policy.onboardingOneReady, normalizedWebsite: one.normalizedWebsite }, stepTwo: { ready: policy.onboardingTwoReady } };
}

export async function stepOneValidation(input: StepOneInput) {
  const facts = stepOneValidationFacts(input);
  const policy = await runDestinyServerLogic({ auditComplete: 0, criticalIssues: 0, warnings: 0, rankingKeywords: 0, newKeywords: 0, lostKeywords: 0, contentGaps: 0, reviewCount: 0, onboardingOneFields: facts.fieldCount, onboardingEmailValid: Number(facts.emailValid), onboardingUrlValid: Number(facts.urlValid) });
  return { ready: policy.onboardingOneReady, normalizedWebsite: facts.normalizedWebsite };
}

export async function stepTwoValidation(input: { productsServices: string; problem: string; customer: string; audienceGoals: string }) {
  const facts = stepTwoValidationFacts(input);
  const policy = await runDestinyServerLogic({ auditComplete: 0, criticalIssues: 0, warnings: 0, rankingKeywords: 0, newKeywords: 0, lostKeywords: 0, contentGaps: 0, reviewCount: 0, onboardingTwoFields: facts.fieldCount });
  return { ready: policy.onboardingTwoReady };
}
