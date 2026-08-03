import { normalizeWebsite } from "../seo/url";

type StepOneInput = {
  firstName: string;
  lastName: string;
  email: string;
  businessName: string;
  website: string;
};

export function stepOneValidation(input: StepOneInput) {
  if (
    !input.firstName.trim()
    || !input.lastName.trim()
    || !/^\S+@\S+\.\S+$/.test(input.email.trim())
    || !input.businessName.trim()
    || !input.website.trim()
  ) {
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

export function stepTwoValidation(input: { productsServices: string; problem: string; customer: string; audienceGoals: string }) {
  return {
    ready: Boolean(input.productsServices.trim() && input.problem.trim() && input.customer.trim() && input.audienceGoals.trim()),
  };
}
