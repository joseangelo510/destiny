export function auditReadyNotificationCopy(domain: string) {
  const safeDomain = domain.trim() || "your website";
  return {
    title: `Your Destiny plan for ${safeDomain} is ready`,
    body: "Your audit is complete. Start this week’s one useful step, then move through the rest of your guided plan.",
  };
}
