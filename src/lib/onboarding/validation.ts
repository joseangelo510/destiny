import { normalizeWebsite } from "../seo/url";

type StepOneInput = {
  businessName: string;
  website: string;
  business: string;
};

export function stepOneValidation(input: StepOneInput) {
  if (!input.businessName.trim() || !input.website.trim() || !input.business.trim()) {
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
