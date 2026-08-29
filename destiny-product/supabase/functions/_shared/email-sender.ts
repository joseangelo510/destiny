export function reboundSeoSender(value: string | undefined): string | undefined {
  const configured = value?.trim();
  if (!configured) return undefined;
  const address = configured.match(/<([^<>]+)>$/)?.[1]?.trim() ?? configured;
  return `Rebound SEO <${address}>`;
}
