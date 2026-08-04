type JsonRecord = Record<string, unknown>;

export type CompetitorSuggestion = {
  domain: string;
  sharedKeywords: number;
  relation: "search_landscape";
};

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function domain(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
}

const BLOCKED_DOMAINS = /(?:facebook|instagram|linkedin|pinterest|reddit|tiktok|wikipedia|youtube)\.com$/i;

export function parseCompetitorSuggestions(payload: unknown, targetDomain: string, limit = 8): CompetitorSuggestion[] {
  const root = record(payload);
  const task = record(array(root.tasks)[0]);
  const result = record(array(task.result)[0]);
  const target = domain(targetDomain);
  const seen = new Set<string>();
  return array(result.items).flatMap((item) => {
    const row = record(item);
    const candidate = domain(row.domain);
    if (!candidate || candidate === target || BLOCKED_DOMAINS.test(candidate) || seen.has(candidate)) return [];
    seen.add(candidate);
    return [{
      domain: candidate,
      sharedKeywords: typeof row.intersections === "number" ? row.intersections : 0,
      relation: "search_landscape" as const,
    }];
  }).slice(0, Math.max(0, limit));
}
