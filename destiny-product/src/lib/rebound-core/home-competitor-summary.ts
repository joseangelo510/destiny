import type { CompetitorSummary } from "./contracts";

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function list(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function domain(value: unknown) {
  const candidate = text(value);
  if (!candidate) return "";
  try {
    return new URL(candidate.includes("://") ? candidate : `https://${candidate}`).hostname.toLocaleLowerCase("en-US").replace(/^www\./, "");
  } catch {
    return candidate.toLocaleLowerCase("en-US").replace(/^www\./, "").replace(/\/$/, "");
  }
}

function count(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

export function buildHomeCompetitorSummary(input: {
  websiteLabel: string;
  saved: Array<{ name: string; url: string | null }>;
  providerResult: unknown;
}): CompetitorSummary {
  const receipt = record(input.providerResult);
  const provider = receipt.source === "dataforseo" ? receipt : {};
  const measured = list(provider.competitors).map(record).flatMap((item) => {
    const measuredDomain = domain(item.domain);
    if (!measuredDomain) return [];
    return [{ domain: measuredDomain, sharedKeywords: count(item.sharedKeywords) }];
  });
  const measuredByDomain = new Map(measured.map((item) => [item.domain, item.sharedKeywords]));
  const savedDomains = new Set<string>();
  const saved = input.saved.map((item) => {
    const savedDomain = domain(item.url) || domain(item.name);
    if (savedDomain) savedDomains.add(savedDomain);
    return {
      name: item.name.trim() || savedDomain,
      url: item.url,
      domain: savedDomain,
      relationship: "Saved competitor" as const,
      sharedKeywords: measuredByDomain.get(savedDomain) ?? null,
    };
  });
  const discovered = measured.filter((item) => !savedDomains.has(item.domain)).map((item) => ({
    name: item.domain,
    url: `https://${item.domain}`,
    domain: item.domain,
    relationship: "Search competitor" as const,
    sharedKeywords: item.sharedKeywords,
  }));

  return {
    websiteLabel: input.websiteLabel,
    sourceLabel: text(provider.sourceLabel) || (provider.source === "dataforseo" ? "Live DataForSEO audit" : null),
    fetchedAt: text(provider.fetchedAt) || null,
    competitors: [...saved, ...discovered],
  };
}
