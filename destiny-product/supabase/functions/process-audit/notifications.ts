export function auditReadyNotificationCopy(domain: string) {
  const safeDomain = domain.trim() || "your website";
  return {
    title: `Your Destiny weekly plan for ${safeDomain} is ready`,
    body: `Review ${safeDomain}’s clearest opportunity, approve the initial keyword strategy, and start your week 1 plan.`,
  };
}
