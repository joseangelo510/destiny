export type DistributionPlatform = "Quora" | "Reddit";

export type DistributionOpportunityAction = {
  platform: DistributionPlatform;
  url: string;
  hostname: string;
  checkedAt: string | null;
  copyText: string;
};

const HOST_PLATFORM: Record<string, DistributionPlatform> = {
  "quora.com": "Quora",
  "www.quora.com": "Quora",
  "reddit.com": "Reddit",
  "www.reddit.com": "Reddit",
};

function savedString(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function buildDistributionOpportunityAction(input: {
  platform: unknown;
  title: unknown;
  context: unknown;
  url: unknown;
  checkedAt: unknown;
}): DistributionOpportunityAction | null {
  const platform = savedString(input.platform);
  const title = savedString(input.title);
  const context = savedString(input.context);
  const url = savedString(input.url);
  const checkedAt = savedString(input.checkedAt) || null;
  if (!title.trim() || !context.trim() || !url || url !== url.trim()) return null;

  try {
    const parsed = new URL(url);
    const destinationPlatform = HOST_PLATFORM[parsed.hostname];
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port) return null;
    if (!destinationPlatform || destinationPlatform !== platform) return null;
    return {
      platform: destinationPlatform,
      url,
      hostname: parsed.hostname,
      checkedAt,
      copyText: [title, context, url, checkedAt ? `Checked ${checkedAt}` : null].filter(Boolean).join("\n"),
    };
  } catch {
    return null;
  }
}

export function distributionOpportunityFreshness(checkedAt: string | null, now = new Date()) {
  if (!checkedAt) return { stale: true, label: "Freshness unavailable — reverify before engaging" };
  const observed = new Date(checkedAt);
  const age = now.getTime() - observed.getTime();
  if (!Number.isFinite(observed.getTime()) || age < -86_400_000) {
    return { stale: true, label: "Freshness unavailable — reverify before engaging" };
  }
  if (age > 14 * 86_400_000) return { stale: true, label: "Stale — reverify before engaging" };
  const label = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(observed);
  return { stale: false, label: `Checked ${label}` };
}
