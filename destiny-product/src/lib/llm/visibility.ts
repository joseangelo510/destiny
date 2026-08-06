type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}
function list(value: unknown) { return Array.isArray(value) ? value : []; }
function text(value: unknown) { return typeof value === "string" ? value : ""; }
function number(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? value : 0; }

function firstResult(payload: unknown) {
  const root = record(payload);
  const task = record(list(root.tasks)[0]);
  if (root.status_code !== 20000 || task.status_code !== 20000) return {};
  return record(list(task.result)[0]);
}

function companyFromDomain(domain: string) {
  const root = domain.replace(/^www\./, "").split(".")[0].replace(/[-_]+/g, " ");
  return root ? root.charAt(0).toUpperCase() + root.slice(1) : domain;
}

const PLATFORM_LABELS: Record<string, string> = {
  chat_gpt: "ChatGPT",
  google: "Google AI Overviews",
};

export type LlmVisibility = {
  status: "available" | "unavailable";
  totalMentions: number;
  aiSearchVolume: number;
  platforms: Array<{ platform: string; mentions: number; aiSearchVolume: number }>;
  topCitedDomains: Array<{ company: string; domain: string; website: string; mentions: number; aiSearchVolume: number }>;
  reason?: string;
};

export function parseLlmVisibility(targetMetricsPayload: unknown, topDomainsPayload: unknown): LlmVisibility {
  const metricsResult = firstResult(targetMetricsPayload);
  const aggregated = record(metricsResult.aggregated_metrics);
  const platforms = list(aggregated.platform).map(record).map((item) => ({
    platform: PLATFORM_LABELS[text(item.key)] ?? text(item.key),
    mentions: number(item.mentions),
    aiSearchVolume: number(item.ai_search_volume),
  })).filter((item) => item.platform);

  const domainsResult = firstResult(topDomainsPayload);
  const domainRows = list(domainsResult.items).length
    ? list(domainsResult.items)
    : list(aggregated.sources_domain);
  const topCitedDomains = domainRows.map(record).map((item) => {
    const domain = text(item.key).replace(/^www\./, "");
    const domainPlatforms = list(item.platform).map(record);
    const directMentions = number(item.mentions);
    const directVolume = number(item.ai_search_volume);
    return {
      company: companyFromDomain(domain),
      domain,
      website: `https://${domain}`,
      mentions: domainPlatforms.length ? domainPlatforms.reduce((total, row) => total + number(row.mentions), 0) : directMentions,
      aiSearchVolume: domainPlatforms.length ? domainPlatforms.reduce((total, row) => total + number(row.ai_search_volume), 0) : directVolume,
    };
  }).filter((item) => item.domain).sort((a, b) => b.mentions - a.mentions).slice(0, 10);

  return {
    status: platforms.length || topCitedDomains.length ? "available" : "unavailable",
    totalMentions: platforms.reduce((total, item) => total + item.mentions, 0),
    aiSearchVolume: platforms.reduce((total, item) => total + item.aiSearchVolume, 0),
    platforms,
    topCitedDomains,
    ...(platforms.length || topCitedDomains.length ? {} : { reason: "DataForSEO did not return LLM mention data for this target yet." }),
  };
}
