import { normalizeWebsite } from "../seo/url";

type StepOneInput = {
  businessName: string;
  website: string;
  productsServices: string;
  problem: string;
};

export function stepOneValidation(input: StepOneInput) {
  if (!input.businessName.trim() || !input.website.trim() || !input.productsServices.trim() || !input.problem.trim()) {
    return { ready: false, normalizedWebsite: null };
  }

  try {
    return {
      ready: true,
      normalizedWebsite: normalizeWebsite(input.website).url,
    };
  } catch {
    return { ready: false, normalizedWebsite: null };
  }
}

export function stepTwoValidation(input: { customer: string; audienceGoals: string; country: string }) {
  return {
    ready: Boolean(input.customer.trim() && input.audienceGoals.trim() && input.country.trim()),
  };
}
