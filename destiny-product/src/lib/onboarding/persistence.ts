export type OnboardingBusinessInput = {
  productsServices: string;
  customer: string;
  problem: string;
  standout: string;
};

export function onboardingBusinessColumns(input: OnboardingBusinessInput) {
  return {
    products_services: input.productsServices,
    ideal_customer: input.customer,
    problem_solved: input.problem,
    differentiation: input.standout,
  };
}
