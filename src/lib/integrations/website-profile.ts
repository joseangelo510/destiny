// Typed registry for the "Your website" section of Connections.
// Platform and AI-builder selections are editable profile information —
// truthful metadata Destiny uses to tailor advice — never claimed API
// connections. Only providers with a genuinely implemented connection flow
// may ever render a "Connect" action.

export type WebsitePlatform = {
  id: string;
  label: string;
  // True only when Destiny ships a real, working connection flow for the
  // platform. Guarded by tests: no platform without one can render "Connect".
  liveConnection: boolean;
};

export const WEBSITE_PLATFORMS: readonly WebsitePlatform[] = [
  { id: "wix", label: "Wix", liveConnection: false },
  { id: "webflow", label: "Webflow", liveConnection: false },
  { id: "squarespace", label: "Squarespace", liveConnection: false },
  { id: "shopify", label: "Shopify", liveConnection: false },
  { id: "lovable", label: "Lovable", liveConnection: false },
  { id: "godaddy_website_builder", label: "GoDaddy Website Builder", liveConnection: false },
  { id: "joomla", label: "Joomla", liveConnection: false },
  { id: "weebly", label: "Weebly", liveConnection: false },
  { id: "duda", label: "Duda", liveConnection: false },
  { id: "drupal", label: "Drupal", liveConnection: false },
  { id: "sitecore", label: "Sitecore", liveConnection: false },
  { id: "wordpress", label: "WordPress", liveConnection: true },
  { id: "other", label: "Other", liveConnection: false },
] as const;

export const AI_BUILDER_TOOLS = [
  { id: "chatgpt", label: "ChatGPT" },
  { id: "claude", label: "Claude" },
  { id: "perplexity", label: "Perplexity" },
  { id: "other", label: "Other" },
] as const;

export type BuilderProfile = {
  platform: string | null;
  builderTools: string[];
};

const platformIds = new Set<string>(WEBSITE_PLATFORMS.map((platform) => platform.id));
const toolIds = new Set<string>(AI_BUILDER_TOOLS.map((tool) => tool.id));

export function platformById(id: string | null | undefined) {
  return WEBSITE_PLATFORMS.find((platform) => platform.id === id);
}

// Parse a stored builder_profile JSON value defensively: unknown platforms or
// tools (from older data or manual edits) are dropped, never rendered.
export function parseBuilderProfile(value: unknown): BuilderProfile {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const platform = typeof raw.platform === "string" && platformIds.has(raw.platform) ? raw.platform : null;
  const builderTools = Array.isArray(raw.builderTools)
    ? [...new Set(raw.builderTools.filter((tool): tool is string => typeof tool === "string" && toolIds.has(tool)))]
    : [];
  return { platform, builderTools };
}

export function isValidPlatformSelection(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && platformIds.has(value));
}

export function isValidBuilderToolSelection(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((tool) => typeof tool === "string" && toolIds.has(tool)) && new Set(value).size === value.length;
}

// Truthful copy for a saved platform. Selections are "Saved", never
// "Connected" — connecting is reserved for real account integrations.
export function platformSavedMessage(platformId: string): string {
  const platform = platformById(platformId);
  if (!platform) return "Saved.";
  if (platform.liveConnection) {
    return `Saved. Destiny will tailor your SEO advice for ${platform.label}. You can also connect ${platform.label} directly under Connected accounts.`;
  }
  return `Saved. Destiny will tailor your SEO advice for ${platform.label}. A direct connection isn’t available yet, so we’ll show you where to make changes.`;
}

// Invariant helper: only platforms with a live connection implementation may
// surface a Connect action anywhere in the UI.
export function platformConnectAllowed(platformId: string): boolean {
  return platformById(platformId)?.liveConnection === true;
}
