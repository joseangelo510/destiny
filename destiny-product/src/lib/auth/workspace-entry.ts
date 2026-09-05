type OnboardingEntryState = {
  authenticated: boolean;
  hasWebsite: boolean;
  startNew?: boolean;
};

/** Decide whether onboarding should redirect or render. */
export function onboardingEntryDestination({
  authenticated,
  hasWebsite,
  startNew = false,
}: OnboardingEntryState) {
  if (!authenticated) return "/login?next=%2Fonboarding";
  if (hasWebsite && !startNew) return "/app";
  return null;
}
