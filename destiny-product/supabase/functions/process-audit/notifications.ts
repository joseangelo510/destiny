export function auditReadyNotificationCopy(domain: string) {
  const safeDomain = domain.trim() || "your website";
  return {
    title: `Your Destiny results for ${safeDomain} are ready`,
    body: `Review ${safeDomain}’s clearest opportunity, approve the initial keyword strategy, and start the categorized weekly plan.`,
  };
}
